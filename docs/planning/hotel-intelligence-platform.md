# HotelOS AI — Hotel Intelligence Platform

**מיצוב (GR-016):** לא תחליף PMS ביום הראשון — **שכבת AI ותפעול** שמתחברת מעל המערכות הקיימות.

**שיווק / תוצאות (לא פיצ'רים):** [`gtm-outcomes-pitch.md`](./gtm-outcomes-pitch.md) — כאב→עלות→תוצאה, OS diagram, taglines, מבנה מצגת 20–25 שקפים.  
**מיצוב תחרותי / wedge:** [`competitive-wedge.md`](./competitive-wedge.md) — חוזקות, פערים, סדר land & expand.

## למה זה מקטין חסם אימוץ

| גישה ישנה | גישת HotelOS |
|-----------|----------------|
| rip-and-replace של Opera / Protel / Fidelio / Clock | PMS נשאר מקור אמת להזמנות |
| פרויקט מיגרציה של שנים | פיילוט דומיין אחד (למשל ביקורות / תדריכים / VMS) |
| סיכון תפעולי גבוה | HITL על כסף; connectors לפי בחירה |

HotelOS = **Hotel Intelligence Platform**: תדריכים, משימות, אנומליות, מוניטין, upsell, אירועים, תחזית, אנרגיה, תחזוקה חזויה — מעל/ליד ה־PMS.

## התממשקות מודולרית (בוחרים תחומים)

מקור קטלוג בקוד: `packages/connectors/src/integration-domains.ts`

| דומיין | דוגמאות ספקים | מצב |
|--------|----------------|-----|
| PMS | Opera, Protel, Fidelio, Clock, Mews | adapters / stubs + Mews live |
| Channel / OTA | inbound webhook | MVP |
| VMS | Milestone, Genetec | MVP |
| Reputation | Google, Booking, Tripadvisor | MVP |
| Payments | external PCI gateway | MVP |
| Messaging | WhatsApp outbox | MVP |
| Energy / BMS | meter webhook + occupancy heuristics | MVP |
| Predictive Maintenance | sensor webhook stub + history rules | MVP |
| Access / keys | Assa, Salto… | deferred (PO) |

הרשת בוחרת **רק** את הדומיינים הרלוונטיים לפיילוט — אין חובה לחבר הכל.

### בחירת PMS בקונפיג

```bash
PMS_PROVIDER=opera_stub   # או protel_stub | fidelio_stub | clock_stub | mews_stub | mews | demo
```

ה־Digital Twin ממזג מלאי HotelOS עם snapshot מה־connector. stubs מוכיחים החלפת ספק; חיבור live = פרויקט ספק (credentials + mapping).

## מדדי ROI לפיילוט (חייבים מדידה)

בלי מספרים — קשה לעניין רשת גדולה או משקיע. יעד פיילוט 30–90 יום:

| מדד | איך למדוד ב־HotelOS | יעד לדוגמה |
|-----|----------------------|------------|
| קיצור תדריך בוקר | זמן Meet / CIO digest מול baseline ידני | **−70%** |
| זמן טיפול בתקלה | Incident Center: createdAt → done על `department_tasks` | **−30–50%** |
| מהירות ניקיון חדרים | `room_prep_status` waiting→ready | שיפור ממוצע דקות |
| עומס הנהלה/קבלה | ספירת משימות אוטומטיות (reputation/anomaly) מול ידני | −שעות/שבוע |
| מכירת שירותים נלווים | `upsell_offers` accepted / revenue | **+X%** ancillary |

תבנית דוח פיילוט: [`pilot-roi-scorecard.md`](./pilot-roi-scorecard.md).

## מסר למשקיע / רשת

1. **לא מחליפים PMS** — מחברים.  
2. **ROI מדיד** בתדריך, תקלות, ניקיון, upsell.  
3. **HITL** על כסף ותעריפים — אמון תפעולי.  
4. **מודולרי** — מתחילים מדומיין אחד עם כאב ברור.
