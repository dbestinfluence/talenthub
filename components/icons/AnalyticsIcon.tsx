type IconProps = {
  className?: string;
  active?: boolean;
};

export default function AnalyticsIcon({
  className = "",
  active = false,
}: IconProps) {
  return (
    <svg
      width="20"
      height="34"
      viewBox="0 0 20 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="33"
        rx="9.5"
        stroke={active ? "#9333EA" : "#111827"}
      />

      <path
        d="M11.827 20.284C11.3686 19.8256 11.1111 19.2038 11.1111 18.5555C11.1111 17.9072 11.3686 17.2855 11.827 16.827C12.2855 16.3686 12.9072 16.1111 13.5555 16.1111C14.2038 16.1111 14.8256 16.3686 15.284 16.827C15.7424 17.2855 16 17.9072 16 18.5555C16 19.2038 15.7424 19.8256 15.284 20.284C14.8256 20.7424 14.2038 21 13.5555 21C12.9072 21 12.2855 20.7424 11.827 20.284Z"
        stroke={active ? "#9333EA" : "#111827"}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M13.5556 16.1111V18.5556H16M10.5 10V12.4444C10.5 12.6065 10.5644 12.762 10.679 12.8766C10.7936 12.9912 10.949 13.0556 11.1111 13.0556H13.5556"
        stroke={active ? "#9333EA" : "#111827"}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10.1944 21H6.22222C5.89807 21 5.58719 20.8712 5.35798 20.642C5.12877 20.4128 5 20.1019 5 19.7778V11.2222C5 10.8981 5.12877 10.5872 5.35798 10.358C5.58719 10.1288 5.89807 10 6.22222 10H10.5L13.5556 13.0556V14.2778M13.5556 16.1111V18.5556"
        stroke={active ? "#9333EA" : "#111827"}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}