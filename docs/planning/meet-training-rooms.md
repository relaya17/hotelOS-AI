# HotelOS Meet — חדרי הדרכה (שלב 1)

**סטטוס:** ✅ שלב 1 בקוד (2026-08-03)  
**מדיניות:** `meetings.2026.1` · מסמך Legal `meetings`

## מה נכנס

| יכולת | פירוט |
|--------|--------|
| סוגי חדר | `committee` · `training` · `all_hands` |
| הזמנה | `inviteToken` → קישור Work `/?meetInvite=` |
| נוכחות | join / leave ב־DB (`briefing_attendance`) |
| הסכמת הקלטה | חובה לפני `recordings/start` (גם למארח) |
| מזכירה AI | `agent.meeting_secretary` דרך AI Gateway ב־`POST .../end` |
| יעדים | מסיכום + ידני (`briefing_goals`) |
| ארכיון | סיכומים, יעדים, הודעות, הקלטות — tenant-scoped |

## שלבים הבאים (לא בשלב 1)

- בונוסים מוצעים + HITL
- אוטומציות על סיום חדר (Org Comms / WhatsApp)
- WebRTC רב־משתתפים / ASR אמיתי
- מבחן סיום הדרכה ל־HR

## הדגמה

1. Executive → חדרי בריפינג → סוג **הדרכה** → העתקת קישור Work  
2. אישור מדיניות הקלטה → צ׳אט / סוכן → **סיים פגישה + מזכירה**  
3. Work: `http://localhost:5176/?meetInvite=<token>`
