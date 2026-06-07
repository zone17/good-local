// ============================================================
// RegisterKit.jsx — printable register kit (US1 T023).
// Replaces the QrKit mock. Renders the 5x7 kraft card with a REAL QR of the
// business's qr_url (so the printed code actually scans), a print stylesheet
// for US Letter, the reprint Notice when the kit is stale (R2), a stub
// "Mail me a printed copy" action, and the staff phone-entry box
// wired to the US2 staff_check_in RPC via StaffCheckIn.jsx.
//
// Data: api.getRegisterKit (contracts §3.4). Falls back to a placeholder QR
// payload when there is no backend business (demo).
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { Button, Card, Notice, Divider, Icon, SealMark } from "../ds.js";
import * as api from "../lib/api.js";
import StaffCheckIn from "./StaffCheckIn.jsx";

// Print CSS scoped to this surface — US Letter, kraft card centered, chrome hidden.
const PRINT_CSS = `
@media print {
  @page { size: letter; margin: 0.5in; }
  body * { visibility: hidden; }
  #gl-register-print, #gl-register-print * { visibility: visible; }
  #gl-register-print { position: absolute; inset: 0; margin: 0 auto; }
  .gl-no-print { display: none !important; }
}
`;

export default function RegisterKit({ business }) {
  const [kit, setKit] = useState(null);
  const [error, setError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const mounted = useRef(true);

  const businessName = business?.name ?? "";
  const town = business?.town ?? "";

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const data = await api.getRegisterKit(business?.id ? { businessId: business.id } : {});
        if (mounted.current) setKit(data);
      } catch (err) {
        if (mounted.current) setError(err);
      }
    })();
    return () => { mounted.current = false; };
  }, [business?.id]);

  // The honest QR payload: only ever the real qr_url from the kit (T064 —
  // a printed demo code would scan to nothing; better to show "Generating").
  const qrUrl = kit?.qr_url ?? null;

  useEffect(() => {
    if (!qrUrl) { setQrDataUrl(null); return; }
    // Dynamic import keeps qrcode (~30KB) out of the main entry chunk —
    // it loads only when an owner opens the register-kit surface (R7 budget).
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      )
      .then((url) => mounted.current && setQrDataUrl(url))
      .catch(() => mounted.current && setQrDataUrl(null));
  }, [qrUrl]);

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{PRINT_CSS}</style>

      <div className="gl-no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="gl-eyebrow">Register kit</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.012em", marginTop: 4 }}>
            Print your QR card
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" leadingIcon={<Icon name="share" size={18}/>}
            onClick={() => window.alert("We'll mail a printed kraft card to your business address. (Coming soon.)")}>
            Mail me a printed copy
          </Button>
          <Button onClick={() => window.print()}>Print card</Button>
        </div>
      </div>

      {error ? (
        <Notice tone="ochre" title="Could not load your kit">
          {error.message ?? "Please try again."}
        </Notice>
      ) : null}

      {kit?.reprint_needed ? (
        <Notice tone="ochre" title="Time to reprint" icon={<Icon name="info" size={18}/>}>
          Your code rotated, so the printed card at your register is out of date. Print this fresh
          card and swap it out — patrons scanning the old one are gently told it has changed.
        </Notice>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* The printable card itself */}
        <Card style={{ padding: 20 }}>
          <div className="gl-eyebrow gl-no-print" style={{ marginBottom: 10 }}>5×7 register card · kraft</div>
          <div id="gl-register-print" style={{
            background: "var(--paper-300)", color: "var(--pine-1000)", borderRadius: 8,
            padding: "26px 22px", aspectRatio: "5/7", display: "flex", flexDirection: "column", justifyContent: "space-between",
            maxWidth: 420, marginInline: "auto",
          }}>
            <div style={{ textAlign: "center" }}>
              <div className="gl-eyebrow" style={{ color: "var(--pine-700)" }}>{town}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.012em" }}>
                {businessName}
              </div>
            </div>
            <div style={{ display: "grid", placeItems: "center" }}>
              <div style={{ background: "var(--white, #fff)", padding: 12, borderRadius: 6 }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`Check-in QR for ${businessName}`} width={180} height={180} style={{ display: "block" }}/>
                ) : (
                  <div style={{ width: 180, height: 180, display: "grid", placeItems: "center", color: "var(--ink-500)" }}>
                    Generating code…
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                Earn your first stamp.
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 6, lineHeight: 1.4 }}>
                {kit?.instructions ?? "Hold your camera over the code. No app needed — adds to your wallet."}
              </div>
              <div style={{ marginTop: 10, color: "var(--pine-700)", display: "grid", placeItems: "center" }}>
                <SealMark size={36}/>
              </div>
            </div>
          </div>
        </Card>

        {/* Tips + live staff check-in (US2) */}
        <Card className="gl-no-print" style={{ padding: 20 }}>
          <div className="gl-eyebrow">Tips</div>
          <ul style={{ marginTop: 10, paddingLeft: 18, color: "var(--ink-700)", lineHeight: 1.6, fontSize: 14 }}>
            <li>Print on kraft cardstock if you can — the brand expects it.</li>
            <li>Tape it to the side of the register where the hand naturally rests.</li>
            <li>Replace the kit if it gets wet or torn — your code rotates every 7 days for trust.</li>
            <li>For patrons who can&apos;t scan: ask their phone number and check them in from this screen.</li>
          </ul>
          <Divider dashed/>
          <StaffCheckIn businessId={business?.id ?? kit?.business_id}/>
        </Card>
      </div>
    </div>
  );
}
