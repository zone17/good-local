import React from "react";

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactElement;
}
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
}

export function Field(props: FieldProps): JSX.Element;
export function Input(props: InputProps): JSX.Element;
export function Textarea(props: TextareaProps): JSX.Element;
export function Select(props: SelectProps): JSX.Element;
export function Switch(props: SwitchProps): JSX.Element;
