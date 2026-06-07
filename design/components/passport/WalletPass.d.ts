import React from "react";

/**
 * Apple/Google Wallet pass mock — patron side.
 *
 * @startingPoint section="Passport" subtitle="The wallet pass — pine-leather passport cover" viewport="700x520"
 */
export interface WalletPassProps {
  businessName: string;
  region?: string;
  count?: number;
  total?: number;
  perkLabel?: React.ReactNode;
  perkSub?: React.ReactNode;
  /** Tone of the leather. Default `pine` = deep forest leather; `kraft` = inside-page warm cream. */
  variant?: "pine" | "river" | "ink" | "kraft";
  /** 2-4 letter business code displayed inside the debossed corner stamp. Derived from `businessName` if omitted. */
  stampCode?: string;
  /** Date shown along the bottom arc of the corner stamp. Default 06·14·2026. */
  stampDate?: string;
  serial?: string;
  footer?: React.ReactNode;
  expires?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function WalletPass(props: WalletPassProps): JSX.Element;
