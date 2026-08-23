type IconProps = {
  className?: string;
  active?: boolean;
};

export default function QuotationIcon({
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
        stroke={active ? "#2563EB" : "#111827"}
      />

      <path
        d="M15.7 17.721C15.2905 17.578 14.855 17.5 14.4 17.5V12.3H5.3V20.919L5.95 20.49L7.9 21.79L9.85 20.49L10.526 20.9385C10.5 21.075 10.5 21.244 10.5 21.4C10.5 21.8225 10.565 22.232 10.695 22.609L9.85 22.05L7.9 23.35L5.95 22.05L4 23.35V11H15.7V17.721ZM13.75 18.8V20.75H11.8V22.05H13.75V24H15.05V22.05H17V20.75H15.05V18.8H13.75Z"
        fill={active ? "#2563EB" : "#111827"}
      />
    </svg>
  );
}