import Spinner from "./Spinner";

export default function Button({
  children,
  onClick,
  variant = "primary", // primary, danger, ghost
  isLoading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const baseStyles = "flex items-center justify-center px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
    ghost: "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white",
    outline: "border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
      {children}
    </button>
  );
}