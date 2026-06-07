import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "flat" | "kraft" | "bordered" | "pine";
  as?: keyof JSX.IntrinsicElements;
  padding?: string | number;
  children: React.ReactNode;
}

export function Card(props: CardProps): JSX.Element;
