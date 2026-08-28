"use client";

type Props = {
  message: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

// Submit button that asks for confirmation before letting the form's
// Server Action run. Without JS the form still submits (no confirmation),
// which is an acceptable fallback for this app.
export function ConfirmButton({ message, children, className, ...rest }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
