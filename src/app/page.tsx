"use client";

import { useState, useEffect } from "react";
import Link from "next/link";


/* ─── Light status badge ────────────────────────────────── */
function LBadge({ color, label }: { color: string; label: string }) {
  const map: Record<string, [string, string]> = {
    green:  ["#DCFCE7", "#16A34A"],
    orange: ["#FFF0EE", "#FD2400"],
    blue:   ["#F3F4F6", "#374151"],
    gray:   ["#F3F4F6", "#6B7280"],
  };
  const [bg, text] = map[color] ?? map.gray;
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: bg, color: text, whiteSpace: "nowrap", letterSpacing: 0.2 }}>
      {label}
    </span>
  );
}

/* ─── Demo Sidebar ──────────────────────────────────────── */
function DemoSidebar({ active }: { active: string }) {
  const items = ["Dashboard", "Orders", "Menu", "Inventory", "Analytics", "CRM", "Staff", "Settings"];
  return (
    <div style={{ width: 186, background: "#F4F4F5", borderRight: "1px solid #E5E7EB", padding: "16px 10px", flexShrink: 0 }}>
      <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 17, fontWeight: 700, color: "#111827", padding: "4px 12px 16px", borderBottom: "1px solid #E5E7EB", marginBottom: 8 }}>
        Blunch<span style={{ color: "#FD2400" }}>.</span>
      </div>
      {items.map(item => (
        <div key={item} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 7,
          fontSize: 11.5, fontWeight: item === active ? 600 : 400, marginBottom: 1, cursor: "default",
          color: item === active ? "#FD2400" : "#9CA3AF",
          background: item === active ? "rgba(253,36,0,0.07)" : "transparent",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", flexShrink: 0, opacity: item === active ? 1 : 0.7 }} />
          {item}
        </div>
      ))}
    </div>
  );
}

/* ─── Demo card style ───────────────────────────────────── */
const dc: React.CSSProperties = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14 };

/* ─── Demo Screens ──────────────────────────────────────── */
function DemoDashboard() {
  return (
    <div style={{ background: "#FAFAFA", display: "flex", height: 520 }}>
      <DemoSidebar active="Dashboard" />
      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 15, fontWeight: 700, color: "#111827" }}>Dashboard</span>
          <div style={{ display: "flex", gap: 3 }}>
            {["Today", "Week", "Month"].map((t, i) => (
              <div key={t} style={{ padding: "4px 11px", borderRadius: 100, background: i === 0 ? "#111827" : "#F3F4F6", color: i === 0 ? "#fff" : "#6B7280", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[{ l: "Revenue", v: "৳48,250", c: "+12.4%", col: "#059669" }, { l: "Orders", v: "143", c: "+8 today", col: "#059669" }, { l: "Avg. Bill", v: "৳337", c: "+5.1%", col: "#059669" }, { l: "Margin", v: "31.2%", c: "+1.8%", col: "#059669" }].map(s => (
            <div key={s.l} style={dc}>
              <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{s.l}</div>
              <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 19, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: s.col, marginTop: 4, fontWeight: 600 }}>{s.c}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10 }}>
          <div style={dc}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, display: "flex", justifyContent: "space-between", textTransform: "uppercase", letterSpacing: 0.5 }}>
              <span>Recent Orders</span><span style={{ color: "#FD2400", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>View all</span>
            </div>
            {[{ id: "#042", items: "Wagyu Burger × 2, Fries", amt: "৳1,950", s: "Served", c: "green" }, { id: "#041", items: "Truffle Ramen × 1, Gyoza × 2", amt: "৳1,420", s: "Cooking", c: "orange" }, { id: "#040", items: "Sashimi Set × 1", amt: "৳2,800", s: "New", c: "blue" }, { id: "#039", items: "Spicy Tonkotsu × 2", amt: "৳980", s: "Served", c: "green" }].map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #F9FAFB" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#111827", width: 48 }}>{o.id}</span>
                <span style={{ fontSize: 10, color: "#6B7280", flex: 1 }}>{o.items}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#111827", marginRight: 8 }}>{o.amt}</span>
                <LBadge color={o.c} label={o.s} />
              </div>
            ))}
          </div>
          <div style={dc}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Top Items Today</div>
            {[{ name: "Wagyu Burger", sold: 28, p: 68 }, { name: "Truffle Ramen", sold: 22, p: 54 }, { name: "Gyoza", sold: 41, p: 100 }, { name: "Sashimi Set", sold: 11, p: 27 }, { name: "Matcha Ice Cream", sold: 35, p: 85 }].map((item, i) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: "#D1D5DB", width: 10, fontWeight: 700 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "#111827" }}>{item.name}</div>
                  <div style={{ height: 3, background: "#F3F4F6", borderRadius: 2, marginTop: 3 }}>
                    <div style={{ height: "100%", width: `${item.p}%`, background: "#111827", borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontSize: 9.5, color: "#9CA3AF" }}>{item.sold}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoOrders() {
  return (
    <div style={{ background: "#FAFAFA", display: "flex", height: 520 }}>
      <DemoSidebar active="Orders" />
      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 15, fontWeight: 700, color: "#111827" }}>Live Orders</span>
          <div style={{ display: "flex", gap: 3 }}>
            {["All (14)", "Dine-in (8)", "Takeaway (4)", "Delivery (2)"].map((t, i) => (
              <div key={t} style={{ padding: "4px 10px", borderRadius: 100, background: i === 0 ? "#111827" : "#F3F4F6", color: i === 0 ? "#fff" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { id: "#ORD-042", table: "T-04", items: ["Wagyu Burger × 2", "Truffle Fries × 1", "Lemonade × 2"], total: "৳2,490", s: "Cooking", c: "orange", time: "8 min" },
            { id: "#ORD-041", table: "T-07", items: ["Sashimi Set × 1", "Miso Soup × 1"], total: "৳3,100", s: "Ready", c: "green", time: "2 min" },
            { id: "#ORD-040", table: "T-02", items: ["Ramen × 2", "Gyoza × 1", "Sake × 1"], total: "৳2,120", s: "New", c: "blue", time: "just now" },
            { id: "#ORD-039", table: "T-11", items: ["Tonkotsu × 1", "Noodles × 1"], total: "৳980", s: "Served", c: "green", time: "15 min" },
            { id: "#ORD-038", table: "Takeaway", items: ["Bento Box × 3", "Mochi × 2"], total: "৳1,850", s: "Cooking", c: "orange", time: "5 min" },
            { id: "#ORD-037", table: "T-09", items: ["Sushi × 12 pcs", "Green Tea × 2"], total: "৳1,560", s: "New", c: "blue", time: "just now" },
          ].map(o => (
            <div key={o.id} style={{ ...dc, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 12, fontWeight: 700, color: "#111827" }}>{o.id}</div>
                  <div style={{ fontSize: 9.5, color: "#9CA3AF", marginTop: 1 }}>{o.table} · {o.time}</div>
                </div>
                <LBadge color={o.c} label={o.s} />
              </div>
              <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 8 }}>
                {o.items.map(item => <div key={item} style={{ fontSize: 10.5, color: "#6B7280", marginBottom: 2 }}>· {item}</div>)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                <span style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 13, fontWeight: 700, color: "#111827" }}>{o.total}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ padding: "3px 9px", borderRadius: 6, background: "#FFF0EE", color: "#FD2400", fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}>Bill</div>
                  <div style={{ padding: "3px 9px", borderRadius: 6, background: "#F3F4F6", color: "#6B7280", fontSize: 9.5, fontWeight: 600, cursor: "pointer" }}>Edit</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoMenu() {
  return (
    <div style={{ background: "#FAFAFA", display: "flex", height: 520 }}>
      <DemoSidebar active="Menu" />
      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 15, fontWeight: 700, color: "#111827" }}>Menu Management</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>🔍 Search…</div>
            <div style={{ padding: "5px 12px", borderRadius: 8, background: "#111827", color: "#fff", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>+ Add Food</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {["All (48)", "Main Course", "Appetizers", "Drinks", "Desserts"].map((c, i) => (
            <div key={c} style={{ padding: "4px 11px", borderRadius: 100, background: i === 0 ? "#111827" : "#F3F4F6", color: i === 0 ? "#fff" : "#6B7280", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>{c}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { name: "Wagyu Burger", price: "৳950", cost: "৳320", cat: "Main", active: true, emoji: "🍔" },
            { name: "Truffle Ramen", price: "৳850", cost: "৳280", cat: "Main", active: true, emoji: "🍜" },
            { name: "Sashimi Set", price: "৳1,400", cost: "৳620", cat: "Main", active: true, emoji: "🐟" },
            { name: "Gyoza (6 pcs)", price: "৳360", cost: "৳95", cat: "Appetizer", active: true, emoji: "🥟" },
            { name: "Miso Soup", price: "৳180", cost: "৳35", cat: "Appetizer", active: false, emoji: "🍲" },
            { name: "Matcha Latte", price: "৳280", cost: "৳60", cat: "Drinks", active: true, emoji: "🍵" },
            { name: "Sake Carafe", price: "৳680", cost: "৳220", cat: "Drinks", active: true, emoji: "🍶" },
            { name: "Mochi Ice Cream", price: "৳350", cost: "৳90", cat: "Dessert", active: true, emoji: "🍡" },
          ].map(item => {
            const priceN = parseInt(item.price.replace(/[^0-9]/g, ""));
            const costN = parseInt(item.cost.replace(/[^0-9]/g, ""));
            const margin = Math.round((1 - costN / priceN) * 100);
            return (
              <div key={item.name} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: 72, background: "#F7F7F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative" }}>
                  {item.emoji}
                  <span style={{ position: "absolute", top: 6, right: 6 }}><LBadge color={item.active ? "green" : "gray"} label={item.active ? "Active" : "Off"} /></span>
                </div>
                <div style={{ padding: "10px 10px 8px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", marginBottom: 1 }}>{item.name}</div>
                  <div style={{ fontSize: 9.5, color: "#9CA3AF", marginBottom: 8 }}>{item.cat}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center", paddingTop: 6, borderTop: "1px solid #F3F4F6" }}>
                    <div><div style={{ fontSize: 8, color: "#9CA3AF", fontWeight: 600 }}>PRICE</div><div style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{item.price}</div></div>
                    <div><div style={{ fontSize: 8, color: "#9CA3AF", fontWeight: 600 }}>COST</div><div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{item.cost}</div></div>
                    <div><div style={{ fontSize: 8, color: "#9CA3AF", fontWeight: 600 }}>MARGIN</div><div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>{margin}%</div></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DemoAnalytics() {
  const bars = [38, 52, 44, 67, 59, 73, 85, 62, 78, 91, 55, 70, 48, 83];
  return (
    <div style={{ background: "#FAFAFA", display: "flex", height: 520 }}>
      <DemoSidebar active="Analytics" />
      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 15, fontWeight: 700, color: "#111827" }}>Analytics</span>
          <div style={{ display: "flex", gap: 3 }}>
            {["Today", "7 Days", "30 Days", "Year"].map((t, i) => (
              <div key={t} style={{ padding: "4px 10px", borderRadius: 100, background: i === 1 ? "#111827" : "#F3F4F6", color: i === 1 ? "#fff" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[{ l: "Gross Revenue", v: "৳3,12,450", c: "+18.2%", col: "#059669" }, { l: "Net Profit", v: "৳97,580", c: "+22.1%", col: "#059669" }, { l: "Total Orders", v: "968", c: "+134", col: "#059669" }, { l: "Food Cost %", v: "28.4%", c: "-2.1%", col: "#059669" }].map(s => (
            <div key={s.l} style={dc}>
              <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{s.l}</div>
              <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 17, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: s.col, marginTop: 4, fontWeight: 600 }}>{s.c}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div style={dc}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue — Last 14 Days</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === bars.length - 3 ? "#111827" : "#E5E7EB", borderRadius: "3px 3px 0 0", transition: "all 0.2s" }} />
              ))}
            </div>
          </div>
          <div style={dc}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>Category</div>
            {[{ cat: "Main Course", pct: 58, col: "#111827" }, { cat: "Drinks", pct: 22, col: "#6B7280" }, { cat: "Appetizers", pct: 12, col: "#FD2400" }, { cat: "Desserts", pct: 8, col: "#D1D5DB" }].map(c => (
              <div key={c.cat} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#374151" }}>{c.cat}</span>
                  <span style={{ fontSize: 11, color: "#111827", fontWeight: 700 }}>{c.pct}%</span>
                </div>
                <div style={{ height: 4, background: "#F3F4F6", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${c.pct}%`, background: c.col, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function LandingPage() {
  const [activeDemo, setActiveDemo] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (!autoCycle) return;
    const t = setInterval(() => setActiveDemo(p => (p + 1) % 4), 4500);
    return () => clearInterval(t);
  }, [autoCycle]);

  const DEMO_TABS = ["Dashboard", "POS Orders", "Menu & Recipes", "Analytics"];

  const FEATURES = [
    { icon: "⚡", title: "Smart POS & Live Orders", desc: "Process dine-in, takeout, and delivery simultaneously. Split bills, apply discounts, and close tables in seconds with real-time kitchen sync.", large: true, accent: "#FD2400", bg: "#FFF0EE" },
    { icon: "🍽️", title: "Menu Engine", desc: "Build complex menus with ingredients, recipes, modifiers and option groups. Automatic food cost and margin tracking.", large: false, accent: "#F59E0B", bg: "#FFFBEB" },
    { icon: "📦", title: "Live Inventory", desc: "Real-time stock tracking with low-stock alerts, purchase requests, asset management, and full history.", large: false, accent: "#10B981", bg: "#F0FDF4" },
    { icon: "📊", title: "Analytics & Reports", desc: "Revenue trends, food margins, top-selling items, and expense breakdowns in beautifully clear charts.", large: false, accent: "#374151", bg: "#F3F4F6" },
    { icon: "🏢", title: "Multi-Outlet Management", desc: "Run multiple restaurants and outlets from one unified account. Each location with its own settings, team, and reports visible from the top.", large: true, accent: "#6B7280", bg: "#F7F7F7" },
    { icon: "👥", title: "Roles & Access Control", desc: "Assign owners, managers, cashiers, and viewers per restaurant. Full audit logs for every action taken.", large: false, accent: "#374151", bg: "#F3F4F6" },
  ];

  return (
    <>
      <style>{`
        @keyframes lp-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes lp-fadeup { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-hero-float { 0%,100%{transform:translateY(0) rotateX(5deg) rotateY(-1.5deg)} 50%{transform:translateY(-8px) rotateX(5deg) rotateY(-1.5deg)} }

        .lp-root * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .lp-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 13px 28px; border-radius: 10px;
          font-size: 14.5px; font-weight: 500; cursor: pointer;
          text-decoration: none; border: none; transition: all 0.22s;
          font-family: var(--font-poppins), sans-serif;
          position: relative; overflow: hidden;
        }
        .lp-btn-primary:hover { transform: translateY(-2px); }

        .lp-btn-ghost {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 13px 24px; border-radius: 10px; background: transparent;
          font-size: 14.5px; font-weight: 500; cursor: pointer;
          text-decoration: none; transition: all 0.22s;
          font-family: var(--font-poppins), sans-serif;
        }

        .lp-mockup-wrap { perspective: 1400px; }
        .lp-mockup-inner {
          border-radius: 14px; overflow: hidden;
          animation: lp-hero-float 8s ease-in-out infinite;
          box-shadow: 0 32px 100px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06);
          transition: box-shadow 0.3s;
        }
        .lp-mockup-wrap:hover .lp-mockup-inner { box-shadow: 0 48px 120px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08); }

        .lp-win-bar { display:flex; align-items:center; gap:6px; padding:10px 16px; border-bottom: 1px solid rgba(0,0,0,0.06); background: #F3F4F6; }
        .lp-dot { width:10px; height:10px; border-radius:50%; }

        .lp-feature-card {
          background: #fff; border: 1px solid #E5E7EB;
          border-radius: 18px; padding: 30px; position: relative; overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s, border-color 0.3s;
          cursor: default;
        }
        .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.08); border-color: #D1D5DB; }

        .lp-demo-tab {
          padding: 7px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.2s; border: none; background: none;
          font-family: var(--font-poppins), sans-serif;
          color: #374151;
        }

        .lp-step-num {
          font-family: var(--font-poppins), sans-serif;
          font-size: 56px; font-weight: 700; line-height: 1;
          letter-spacing: -2px; opacity: 0.07; position: absolute; top: 20px; right: 24px;
          color: #111827;
        }

        @media (max-width: 900px) {
          .lp-bento { grid-template-columns: 1fr !important; }
          .lp-bento .lp-large { grid-column: span 1 !important; }
          .lp-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-footer-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-hero-mockup { display: none !important; }
          .lp-nav-links { display: none !important; }
          .lp-hero-h1 { font-size: 44px !important; letter-spacing: -2px !important; }
        }
        @media (max-width: 600px) {
          .lp-footer-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          .lp-hero-cta { flex-direction: column !important; }
          .lp-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-section-inner { padding: 72px 20px !important; }
        }
      `}</style>

      <div style={{ fontFamily: "Inter, sans-serif", background: "#FFFFFF", color: "#111827", minHeight: "100vh", overflow: "hidden" }}>

        {/* ── NAV ── */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid #E5E7EB" : "1px solid transparent",
          transition: "all 0.3s ease",
        }}>
          <div style={{ maxWidth: 1260, margin: "0 auto", padding: "0 32px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ fontFamily: "var(--font-poppins),sans-serif", fontWeight: 700, fontSize: 21, color: "#111827", textDecoration: "none", letterSpacing: -0.5 }}>
              Blunch<span style={{ color: "#FD2400" }}>.</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/login" style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13.5, fontWeight: 500, color: "#374151", textDecoration: "none", transition: "all 0.2s", fontFamily: "var(--font-poppins),sans-serif", background: "transparent" }}>
                Login
              </Link>
              <Link href="/signup" className="lp-btn-primary" style={{ background: "#111827", color: "#fff", padding: "9px 20px", fontSize: 13.5 }}>
                Get Started →
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "110px 32px 80px", position: "relative",
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, #FFF0EE 0%, #FFFFFF 60%)",
        }}>
          {/* Dot pattern */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.35,
            backgroundImage: "radial-gradient(#D1D5DB 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", animation: "lp-fadeup 0.7s ease both" }}>
            {/* H1 */}
            <h1 className="lp-hero-h1" style={{
              fontFamily: "var(--font-poppins),sans-serif",
              fontSize: "clamp(46px, 6.5vw, 84px)", fontWeight: 700, lineHeight: 1.05,
              letterSpacing: "-2.5px", color: "#111827", maxWidth: 820, marginBottom: 20,
            }}>
              Run every table.<br />
              <span style={{ color: "#FD2400" }}>Master every order.</span>
            </h1>

            <p style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.65, color: "#6B7280", maxWidth: 520, marginBottom: 38 }}>
              The complete restaurant management platform — POS, menu, inventory, analytics, and team controls. One login. Every location.
            </p>

            <div className="lp-hero-cta" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 72 }}>
              <Link href="/signup" className="lp-btn-primary" style={{ background: "#111827", color: "#fff" }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "#1F2937"; (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 32px rgba(0,0,0,0.2)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "#111827"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                Start for free →
              </Link>
              <a href="#demo" className="lp-btn-ghost" style={{ color: "#6B7280", border: "1px solid #E5E7EB" }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "#111827"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}>
                <span style={{ fontSize: 11 }}>▶</span> See it in action
              </a>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <div className="lp-hero-mockup lp-mockup-wrap" style={{ width: "100%", maxWidth: 1060, position: "relative", zIndex: 1 }}>
            <div className="lp-mockup-inner">
              <div className="lp-win-bar">
                <div className="lp-dot" style={{ background: "#FF5F56" }} />
                <div className="lp-dot" style={{ background: "#FFBD2E" }} />
                <div className="lp-dot" style={{ background: "#27C93F" }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9CA3AF" }}>blunch.app/dashboard</div>
              </div>
              <DemoDashboard />
            </div>
          </div>
        </section>


        {/* ── FEATURES ── */}
        <section className="lp-section-inner" id="features" style={{ maxWidth: 1260, margin: "0 auto", padding: "96px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "end", marginBottom: 56 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#FD2400", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                ⬡ Features
              </div>
              <h2 style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: "clamp(30px, 3.5vw, 46px)", fontWeight: 700, letterSpacing: "-1.5px", color: "#111827", lineHeight: 1.1, margin: 0 } as React.CSSProperties}>
                Everything a restaurant needs.
                <span style={{ color: "#FD2400" }}> Nothing it doesn&apos;t.</span>
              </h2>
            </div>
            <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "#6B7280", maxWidth: 440, marginTop: 0 }}>
              Built from the ground up for how restaurants actually operate — from single-location cafés to multi-outlet chains running hundreds of covers a night.
            </p>
          </div>

          <div className="lp-bento" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feature-card"
                style={{ gridColumn: f.large ? "span 2" : "span 1" } as React.CSSProperties}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, fontSize: 20 }}>
                  {f.icon}
                </div>
                <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 17.5, fontWeight: 700, color: "#111827", marginBottom: 10, letterSpacing: -0.3 }}>{f.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#6B7280" }}>{f.desc}</div>
                {f.large && (
                  <div style={{ marginTop: 22, display: "flex", gap: 7, flexWrap: "wrap" as const }}>
                    {["Dine-in", "Takeaway", "Delivery", "QR Menu"].map(tag => (
                      <span key={tag} style={{ padding: "4px 12px", borderRadius: 100, background: "#F7F7F7", border: "1px solid #E5E7EB", fontSize: 11, fontWeight: 600, color: "#6B7280" }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── DEMO ── */}
        <section className="lp-section-inner" id="demo" style={{ maxWidth: 1260, margin: "0 auto", padding: "0 32px 96px" }}>
          <div style={{ background: "#F7F7F7", borderRadius: 24, padding: "56px 48px", border: "1px solid #E5E7EB" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#FD2400", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>◈ Live Demo</div>
              <h2 style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 700, letterSpacing: -1.5, color: "#111827", margin: "0 auto 12px", maxWidth: 500 } as React.CSSProperties}>See Blunch in action</h2>
              <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 400, margin: "0 auto" }}>Every module designed to reduce friction across your entire team.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #E5E7EB", padding: 4, borderRadius: 12, width: "fit-content", marginBottom: 20 }}>
              {DEMO_TABS.map((tab, i) => (
                <button key={i} className="lp-demo-tab"
                  style={{ background: activeDemo === i ? "#111827" : "transparent", color: activeDemo === i ? "#fff" : "#374151" }}
                  onClick={() => { setActiveDemo(i); setAutoCycle(false); }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Screen */}
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
              <div className="lp-win-bar">
                <div className="lp-dot" style={{ background: "#FF5F56" }} />
                <div className="lp-dot" style={{ background: "#FFBD2E" }} />
                <div className="lp-dot" style={{ background: "#27C93F" }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#9CA3AF" }}>
                  blunch.app/{["dashboard", "orders", "food/menu", "analytics"][activeDemo]}
                </div>
              </div>
              {activeDemo === 0 && <DemoDashboard />}
              {activeDemo === 1 && <DemoOrders />}
              {activeDemo === 2 && <DemoMenu />}
              {activeDemo === 3 && <DemoAnalytics />}
            </div>

            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
              {DEMO_TABS.map((_, i) => (
                <div key={i} onClick={() => { setActiveDemo(i); setAutoCycle(false); }}
                  style={{ width: i === activeDemo ? 20 : 6, height: 6, borderRadius: 3, background: i === activeDemo ? "#111827" : "#E5E7EB", transition: "all 0.3s", cursor: "pointer" }} />
              ))}
            </div>
          </div>
        </section>


        {/* ── HOW IT WORKS ── */}
        <section className="lp-section-inner" style={{ maxWidth: 1260, margin: "0 auto", padding: "96px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#FD2400", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>◉ How It Works</div>
            <h2 style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 700, letterSpacing: -1.5, color: "#111827", margin: 0 } as React.CSSProperties}>Up and running in minutes</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { n: "01", title: "Create your restaurant", desc: "Add your restaurant profile, logo, menu items, and team in under 10 minutes. Multi-outlet support from day one." },
              { n: "02", title: "Configure your team", desc: "Role-based access means each team member only sees what they need. Assign owners, managers, cashiers, and viewers per location." },
              { n: "03", title: "Start taking orders", desc: "Your POS is live. Process orders, track inventory, print receipts, and watch real-time analytics update automatically." },
            ].map((step) => (
              <div key={step.n} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: "36px 32px", position: "relative", overflow: "hidden" }}>
                <div className="lp-step-num">{step.n}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFF0EE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 16, fontWeight: 800, color: "#FD2400", fontFamily: "var(--font-poppins),sans-serif" }}>{step.n}</div>
                <div style={{ fontFamily: "var(--font-poppins),sans-serif", fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{step.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#6B7280" }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ background: "#F7F7F7", padding: "64px 32px 40px", borderTop: "1px solid #E5E7EB" }}>
          <div className="lp-footer-grid" style={{ maxWidth: 1260, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr", gap: 60, marginBottom: 56 }} className="lp-footer-grid">
              <div>
                <Link href="/" style={{ fontFamily: "var(--font-poppins),sans-serif", fontWeight: 700, fontSize: 22, color: "#111827", textDecoration: "none", display: "block", marginBottom: 6 }}>
                  Blunch<span style={{ color: "#FD2400" }}>.</span>
                </Link>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 14, letterSpacing: 0.3 }}>by gridlab</div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: "#6B7280", maxWidth: 250 }}>
                  The complete restaurant management platform. Built for modern kitchens, loved by restaurant teams.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
                  {["𝕏", "in", "ig"].map(icon => (
                    <div key={icon} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#6B7280", cursor: "pointer" }}>{icon}</div>
                  ))}
                </div>
              </div>
              {[
                { title: "PRODUCT", links: [{ label: "Features", href: "#features" }, { label: "Demo", href: "#demo" }, { label: "Login", href: "/login" }, { label: "Sign Up Free", href: "/signup" }] },
                { title: "MODULES", links: [{ label: "POS & Orders", href: "#" }, { label: "Menu Management", href: "#" }, { label: "Inventory", href: "#" }, { label: "Analytics", href: "#" }] },
                { title: "GRIDLAB", links: [{ label: "About", href: "#" }, { label: "Contact", href: "#" }, { label: "Privacy Policy", href: "#" }, { label: "Terms of Service", href: "#" }] },
              ].map(col => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 18 }}>{col.title}</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                    {col.links.map(link => (
                      <li key={link.label}>
                        <Link href={link.href} style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", transition: "color 0.2s" }}
                          onMouseOver={e => (e.currentTarget as HTMLElement).style.color = "#111827"}
                          onMouseOut={e => (e.currentTarget as HTMLElement).style.color = "#6B7280"}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "#9CA3AF", flexWrap: "wrap" as const, gap: 8 }}>
              <span>© 2026 gridlab. All rights reserved.</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Made with <span style={{ color: "#FD2400" }}>♥</span> for restaurants
              </span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
