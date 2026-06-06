import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "md" | "lg";
  bordered?: boolean;
  /** Required — accessible label for the icon. */
  label: string;
  children: React.ReactNode;
}

export function IconButton(props: IconButtonProps): JSX.Element;
