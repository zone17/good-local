import React from "react";

export interface NoticeProps {
  tone?: "pine" | "ochre" | "stamp" | "river";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
export interface RowProps {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}
export interface DividerProps {
  dashed?: boolean;
  strong?: boolean;
  style?: React.CSSProperties;
}
export function Notice(props: NoticeProps): JSX.Element;
export function Row(props: RowProps): JSX.Element;
export function Divider(props: DividerProps): JSX.Element;
