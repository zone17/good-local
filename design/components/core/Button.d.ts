import React from "react";

/**
 * Good Local — Button
 *
 * @startingPoint section="Core" subtitle="Brand action — pine, paper, stamp, wallet" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "wallet";
  size?: "sm" | "lg";
  block?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

export function Button(props: ButtonProps): JSX.Element;
