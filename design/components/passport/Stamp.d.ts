import React from "react";

export type StampState = "earned" | "empty" | "locked";

export interface StampProps {
  state?: StampState;
  /** Short uppercase label inside the stamp — usually the business code (e.g. "BMR"). */
  label?: string;
  /** Date string MM·DD displayed below the label. */
  date?: string;
  size?: number;
  /** Trigger the just-stamped halo animation. */
  just?: boolean;
  /** Override stamp rotation in degrees — defaults to -3°. */
  rotate?: number;
  className?: string;
}

export interface StampSpec {
  label?: string;
  date?: string;
  state?: StampState;
  rotate?: number;
}

/**
 * Patron stamp grid.
 *
 * @startingPoint section="Passport" subtitle="Visit-count grid for the patron home" viewport="700x320"
 */
export interface StampGridProps {
  stamps?: StampSpec[];
  /** Pad with empties up to this number. */
  total?: number;
  columns?: number;
  gap?: number;
  size?: number;
}

export function Stamp(props: StampProps): JSX.Element;
export function StampGrid(props: StampGridProps): JSX.Element;
