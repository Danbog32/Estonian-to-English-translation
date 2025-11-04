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

export function CastIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 -960 960 960" className={className}>
      <path
        d="M480-480Zm320 320H600q0-20-1.5-40t-4.5-40h206v-480H160v46q-20-3-40-4.5T80-680v-40q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160Zm-720 0v-120q50 0 85 35t35 85H80Zm200 0q0-83-58.5-141.5T80-360v-80q117 0 198.5 81.5T360-160h-80Zm160 0q0-75-28.5-140.5t-77-114q-48.5-48.5-114-77T80-520v-80q91 0 171 34.5T391-471q60 60 94.5 140T520-160h-80Z"
        fill="currentColor"
      />
    </svg>
  );
}
