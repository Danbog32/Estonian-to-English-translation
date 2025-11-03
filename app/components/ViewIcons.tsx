export function LeftFocusedViewIcon({
  className = "opacity-90",
}: {
  className?: string;
}) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className={className}>
      <rect
        x="3"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function RightFocusedViewIcon({
  className = "opacity-90",
}: {
  className?: string;
}) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className={className}>
      <rect
        x="13"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function SplitViewIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className={className}>
      <rect
        x="3"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="4"
        width="8"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="11.5"
        y="4"
        width="1"
        height="16"
        className="fill-current"
        opacity="0.6"
      />
    </svg>
  );
}

export function LanguageIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 -960 960 960" className={className}>
      <path
        d="m476-80 182-480h84L924-80h-84l-43-122H603L560-80h-84ZM160-200l-56-56 202-202q-35-35-63.5-80T190-640h84q20 39 40 68t48 58q33-33 68.5-92.5T484-720H40v-80h280v-80h80v80h280v80H564q-21 72-63 148t-83 116l96 98-30 82-122-125-202 201Zm468-72h144l-72-204-72 204Z"
        fill="currentColor"
      />
    </svg>
  );
}
