import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createInventoryItem,
  createPurchaseOrder,
  listInventory,
  listPurchaseOrders,
  listVendors,
  receivePurchaseOrder,
  suggestAutonomyLowStockReorder,
  type InventoryCategory,
  type InventoryItemDto,
  type PurchaseOrderDto,
  type VendorDto,
} from "@hotelos/web-client";

export type ProcurementPanelProps = {
  readonly hotelId: string;
};

const categoryLabel: Record<InventoryCategory, string> = {
  towels: "מגבות",
  linens: "מצעים",
  pool_chemicals: "כימיקלים לבריכה",
  cleaning: "ניקיון",
  amenities: "מוצרי פינוק",
  food: "מזון / F&B",
  other: "אחר",
};

const poStatusLabel: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  confirmed: "אושרה",
  received: "התקבלה",
  paid: "שולמה",
  cancelled: "בוטלה",
};

export function ProcurementPanel({ hotelId }: ProcurementPanelProps) {
  const [inventory, setInventory] = useState<readonly InventoryItemDto[]>([]);
  const [orders, setOrders] = useState<readonly PurchaseOrderDto[]>([]);
  const [vendors, setVendors] = useState<readonly VendorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [suggesting, setSuggesting] = useState(false);

  const [itemCategory, setItemCategory] = useState<InventoryCategory>("towels");
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("יחידות");
  const [itemStock, setItemStock] = useState("0");
  const [itemThreshold, setItemThreshold] = useState("10");
  const [addingItem, setAddingItem] = useState(false);

  const [poVendorId, setPoVendorId] = useState("");
  const [poDescription, setPoDescription] = useState("");
  const [poQuantity, setPoQuantity] = useState("1");
  const [poUnitPrice, setPoUnitPrice] = useState("0");
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const [inventoryData, orderData, vendorData] = await Promise.all([
          listInventory(hotelId),
          listPurchaseOrders(hotelId),
          listVendors(),
        ]);
        if (cancelled) return;
        setInventory(inventoryData);
        setOrders(orderData);
        setVendors(vendorData);
        setPoVendorId((prev) => prev || vendorData[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function onAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentStock = Number.parseInt(itemStock, 10);
    const reorderThreshold = Number.parseInt(itemThreshold, 10);
    if (!itemName.trim() || !Number.isFinite(currentStock) || !Number.isFinite(reorderThreshold)) {
      return;
    }
    setAddingItem(true);
    try {
      const created = await createInventoryItem(hotelId, {
        category: itemCategory,
        name: itemName,
        unit: itemUnit,
        currentStock,
        reorderThreshold,
      });
      setInventory((prev) => [...prev, created]);
      setItemName("");
      setItemStock("0");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "הוספת הפריט נכשלה",
      );
    } finally {
      setAddingItem(false);
    }
  }

  async function onCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number.parseInt(poQuantity, 10);
    const unitPrice = Number.parseInt(poUnitPrice, 10);
    if (!poVendorId || !poDescription.trim() || quantity <= 0 || unitPrice < 0) {
      return;
    }
    setCreatingOrder(true);
    try {
      const created = await createPurchaseOrder(hotelId, {
        vendorId: poVendorId,
        items: [{ description: poDescription, quantity, unitPrice }],
      });
      setOrders((prev) => [created, ...prev]);
      setPoDescription("");
      setPoQuantity("1");
      setPoUnitPrice("0");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "יצירת ההזמנה נכשלה",
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  async function onReceive(orderId: string) {
    try {
      const updated = await receivePurchaseOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      const inventoryData = await listInventory(hotelId);
      setInventory(inventoryData);
    } catch {
      setError("קליטת ההזמנה נכשלה, נסו שוב");
    }
  }

  async function onSuggestLowStock() {
    if (!poVendorId) {
      setError("בחרו ספק לפני הצעת רכש");
      return;
    }
    setSuggesting(true);
    setError(undefined);
    try {
      const result = await suggestAutonomyLowStockReorder({
        hotelId,
        vendorId: poVendorId,
        defaultUnitPrice: 25,
      });
      setNotice(
        `Suggest נשלח לאישורי AI: ${result.lowStockCount} פריטים · ₪${result.estimatedTotal}. אשרו בתיבת האישורים → Act ייצור טיוטת PO.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת רכש ממלאי נמוך נכשלה",
      );
    } finally {
      setSuggesting(false);
    }
  }

  const lowStockCount = inventory.filter((item) => item.belowThreshold).length;

  return (
    <div className="panel">
      {loading ? <p className="state">טוען…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card">
        <h2>מלאי (מגבות, מצעים, כימיקלים)</h2>
        <ul className="list">
          {inventory.map((item) => (
            <li key={item.id} className="row">
              <div>
                <h3>{item.name}</h3>
                <p>
                  {categoryLabel[item.category]} · {item.currentStock} {item.unit}
                </p>
              </div>
              {item.belowThreshold ? (
                <span className="status status--low">מתחת לסף — יש להזמין</span>
              ) : (
                <span className="status status--ok">במלאי תקין</span>
              )}
            </li>
          ))}
        </ul>

        <div className="suggest-box">
          <p>
            Suggest→Approve→Act: הצעת השלמת מלאי נמוך לתיבת אישורי AI. אחרי אישור
            נוצרת טיוטת PO בלבד (לא נשלחת לספק).
          </p>
          <label className="select-field">
            <span>ספק להצעה</span>
            <select
              value={poVendorId}
              onChange={(e) => setPoVendorId(e.target.value)}
            >
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={suggesting || lowStockCount === 0 || !poVendorId}
            onClick={() => void onSuggestLowStock()}
          >
            {suggesting
              ? "שולח הצעה…"
              : lowStockCount === 0
                ? "אין מלאי נמוך"
                : `הצע הזמנה ממלאי נמוך (${lowStockCount})`}
          </Button>
        </div>

        <form className="create-form" onSubmit={onAddItem} noValidate>
          <h3>פריט מלאי חדש</h3>
          <label className="select-field">
            <span>קטגוריה</span>
            <select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value as InventoryCategory)}
            >
              {(Object.keys(categoryLabel) as InventoryCategory[]).map((key) => (
                <option key={key} value={key}>
                  {categoryLabel[key]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="שם הפריט"
            name="itemName"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
          <TextField
            label="יחידת מידה"
            name="itemUnit"
            value={itemUnit}
            onChange={(e) => setItemUnit(e.target.value)}
            required
          />
          <TextField
            label="מלאי נוכחי"
            name="itemStock"
            type="number"
            min={0}
            value={itemStock}
            onChange={(e) => setItemStock(e.target.value)}
            required
          />
          <TextField
            label="סף להזמנה מחדש"
            name="itemThreshold"
            type="number"
            min={0}
            value={itemThreshold}
            onChange={(e) => setItemThreshold(e.target.value)}
            required
          />
          <Button type="submit" disabled={addingItem}>
            {addingItem ? "מוסיף…" : "הוסף פריט"}
          </Button>
        </form>
      </section>

      <section className="card">
        <h2>הזמנות רכש</h2>
        <ul className="list">
          {orders.map((order) => {
            const vendor = vendors.find((v) => v.id === order.vendorId);
            return (
              <li key={order.id} className="row">
                <div>
                  <h3>{vendor?.name ?? "ספק"}</h3>
                  <p>
                    {order.totalAmount} {order.currency}
                  </p>
                </div>
                <div className="row__actions">
                  <span className="status status--ok">
                    {poStatusLabel[order.status] ?? order.status}
                  </span>
                  {order.status !== "received" && order.status !== "cancelled" ? (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => void onReceive(order.id)}
                    >
                      סמן כהתקבלה
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <form className="create-form" onSubmit={onCreateOrder} noValidate>
          <h3>הזמנת רכש חדשה</h3>
          <label className="select-field">
            <span>ספק</span>
            <select
              value={poVendorId}
              onChange={(e) => setPoVendorId(e.target.value)}
              required
            >
              <option value="" disabled>
                בחרו ספק
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="תיאור הפריט"
            name="poDescription"
            value={poDescription}
            onChange={(e) => setPoDescription(e.target.value)}
            required
          />
          <TextField
            label="כמות"
            name="poQuantity"
            type="number"
            min={1}
            value={poQuantity}
            onChange={(e) => setPoQuantity(e.target.value)}
            required
          />
          <TextField
            label="מחיר ליחידה (₪)"
            name="poUnitPrice"
            type="number"
            min={0}
            value={poUnitPrice}
            onChange={(e) => setPoUnitPrice(e.target.value)}
            required
          />
          <Button type="submit" disabled={creatingOrder || !poVendorId}>
            {creatingOrder ? "יוצר…" : "צור הזמנת רכש"}
          </Button>
        </form>
      </section>

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-4); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.1rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row__actions { display:flex; flex-direction:column; gap:var(--space-2); align-items:flex-end; }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; }
        .status--ok { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--low { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .create-form { display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .state--ok { color:#0f6a5c; background:rgb(15 106 92 / 10%); padding:.75rem 1rem; border-radius:var(--radius-sm); }
        .suggest-box { display:grid; gap:var(--space-3); border:1px dashed rgb(16 36 31 / 22%); border-radius:var(--radius-sm); padding:var(--space-4); }
        .suggest-box p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
      `}</style>
    </div>
  );
}
