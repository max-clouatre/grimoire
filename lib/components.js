// Grimoire components. Artifacts load them with:
//   <script type="module" src="/grimoire/components.js"></script>
//
// <grim-calendar day="Wed 8" start="8" end="18">
//   <grim-event title="Standup" start="9:15" end="9:30" color="blue"></grim-event>
// </grim-calendar>
// Colors: red orange yellow green blue purple teal. Times are 24h "H:MM".

const hours = t => { const [h, m = 0] = String(t).split(":").map(Number); return h + m / 60; };
const label = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh % 12 || 12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${hh >= 12 ? "PM" : "AM"}`; };

class TvCalendar extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
    new MutationObserver(() => this.render()).observe(this, { childList: true, subtree: true, attributes: true });
  }
  render() {
    const start = Number(this.getAttribute("start") ?? 8), end = Number(this.getAttribute("end") ?? 18), H = 56;
    const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60;
    const events = [...this.querySelectorAll("grim-event")].map(e => ({
      title: e.getAttribute("title") || "", s: hours(e.getAttribute("start")), e: hours(e.getAttribute("end")), color: e.getAttribute("color") || "blue",
    }));
    const rows = Array.from({ length: end - start + 1 }, (_, i) => `<div class="hr" style="top:${i * H}px"><span>${label(start + i)}</span></div>`).join("");
    const evs = events.map(ev => `<div class="ev" style="top:${(ev.s - start) * H + 1}px;height:${Math.max(22, (ev.e - ev.s) * H - 3)}px;background:var(--${ev.color}-soft);border-color:var(--${ev.color})">
      ${ev.title.replace(/</g, "&lt;")}${ev.e - ev.s >= 0.75 ? `<small>${label(ev.s)} – ${label(ev.e)}</small>` : ""}</div>`).join("");
    const showNow = this.hasAttribute("today") && nowH >= start && nowH <= end;
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; }
      .head { position: sticky; top: 0; background: var(--page); padding: 10px 0 8px 58px; font-size: 12px; letter-spacing: .06em; font-family: var(--font-heading); color: var(--muted-foreground); border-bottom: 1px solid var(--border); z-index: 3; text-transform: uppercase; }
      .grid { position: relative; margin: 14px 0 20px; height: ${(end - start) * H}px; }
      .hr { position: absolute; left: 54px; right: 0; border-top: 1px solid var(--border); }
      .hr span { position: absolute; left: -54px; top: -9px; width: 46px; text-align: right; font-size: 11px; color: var(--muted-foreground); }
      .ev { position: absolute; left: 62px; right: 0; border-radius: 6px; border-left: 3px solid; padding: 3px 9px; font-size: 13px; font-weight: 600; overflow: hidden; color: var(--foreground); }
      .ev small { display: block; font-weight: 400; opacity: .7; }
      .now { position: absolute; left: 54px; right: 0; border-top: 2px solid var(--red); z-index: 2; }
      .now::before { content: ""; position: absolute; left: -5px; top: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--red); }
    </style>
    <div class="head">${(this.getAttribute("day") || "").replace(/</g, "&lt;")}</div>
    <div class="grid">${rows}${evs}${showNow ? `<div class="now" style="top:${(nowH - start) * H}px"></div>` : ""}</div>`;
  }
}
customElements.define("grim-calendar", TvCalendar);
customElements.define("grim-event", class extends HTMLElement {});
