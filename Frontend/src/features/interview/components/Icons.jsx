// Small inline SVG icons used by the interview UI.
const base = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
}

const Icon = ({ size = 18, children, ...props }) => (
    <svg {...base} width={size} height={size} aria-hidden="true" {...props}>
        {children}
    </svg>
)

export const SparkleIcon = (p) => (
    <Icon {...p}>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </Icon>
)

export const ClockIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </Icon>
)

export const SettingsIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
)

export const BriefcaseIcon = (p) => (
    <Icon {...p}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </Icon>
)

export const FileIcon = (p) => (
    <Icon {...p}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 13h8M8 17h5" />
    </Icon>
)

export const UserIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
)

export const InfoIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4M12 8h.01" />
    </Icon>
)

export const StarIcon = (p) => (
    <Icon {...p}>
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
    </Icon>
)

export const UploadIcon = (p) => (
    <Icon {...p}>
        <path d="M12 15V4M7 9l5-5 5 5" />
        <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </Icon>
)

export const ChevronRightIcon = (p) => (
    <Icon {...p}>
        <path d="M9 6l6 6-6 6" />
    </Icon>
)

export const LockIcon = (p) => (
    <Icon {...p}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
)
