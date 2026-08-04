import { DEMO_BEATS } from "../../content.js";
import { DEMO_VIDEO_URL } from "../constants.js";
import { RevealSection } from "../reveal-section.js";

export function DemoSection() {
  return (
    <RevealSection
      id="demo"
      className="section demo"
      aria-labelledby="demo-title"
    >
      <p className="eyebrow">דמו מוצר</p>
      <h2 id="demo-title">תראו את ה־wedge בשלוש פעימות</h2>
      <p className="section__lead">
        זה מה שתעברו בשיחת רבע שעה. כשיהיה וידאו מוקלט — הוא יופיע כאן.
      </p>
      {DEMO_VIDEO_URL ? (
        <div className="demo-video">
          <iframe
            title="HotelOS AI product demo"
            src={DEMO_VIDEO_URL}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      <ol className="demo-beats">
        {DEMO_BEATS.map((beat, index) => (
          <li key={beat.id} className="demo-beat">
            <span className="demo-beat__n">{index + 1}</span>
            <div>
              <h3>{beat.title}</h3>
              <p>{beat.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </RevealSection>
  );
}
