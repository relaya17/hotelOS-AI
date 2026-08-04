import { CHAT_DEMO } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function ChatSection() {
  return (
    <RevealSection
      id="chat"
      className="section chat"
      aria-labelledby="chat-title"
    >
      <p className="eyebrow">צ׳אט + אוטומציה</p>
      <h2 id="chat-title">הנהלה מדברת. העובד מקבל משימה.</h2>
      <p className="section__lead">
        הדגמה של צ׳אט מתורגם (משטח Executive). ב־Work — תור משימות, נוכחות
        ו־Copilot לפי תפקיד, לא צ׳אט דו־כיווני מתורגם מלא ב־MVP.
      </p>
      <div className="chat-demo" aria-label="הדגמת צ׳אט מתורגם (Executive)">
        <div className="chat-demo__pane">
          <p className="chat-demo__meta">
            <span>{CHAT_DEMO.senderLabel}</span>
            <span>{CHAT_DEMO.senderLang}</span>
          </p>
          <p className="chat-demo__bubble chat-demo__bubble--out">
            {CHAT_DEMO.outgoing}
          </p>
        </div>
        <div className="chat-demo__bridge" aria-hidden="true">
          <span>תרגום · הדגמה</span>
          <span>+ אוטומציה</span>
        </div>
        <div className="chat-demo__pane">
          <p className="chat-demo__meta">
            <span>{CHAT_DEMO.receiverLabel}</span>
            <span>{CHAT_DEMO.receiverLang}</span>
          </p>
          <p className="chat-demo__bubble chat-demo__bubble--in">
            {CHAT_DEMO.incoming}
          </p>
        </div>
        <p className="chat-demo__auto">{CHAT_DEMO.automation}</p>
      </div>
    </RevealSection>
  );
}
