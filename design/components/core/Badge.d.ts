import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "pine" | "stamp" | "ochre" | "river"
    | "solid-pine" | "solid-stamp" | "solid-ink"
    | "eyebrow";
  children: React.ReactNode;
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "pine" | "stamp" | "ochre";
  children: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
export function Tag(props: TagProps): JSX.Element;
