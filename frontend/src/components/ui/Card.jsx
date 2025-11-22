export default function Card({ children, className = "" }) {
  return (
    <div
      className={`
        relative overflow-hidden
        bg-white/5 backdrop-blur-md 
        border border-white/10 
        rounded-xl 
        p-6 
        text-white
        shadow-xl
        ${className}
      `}
    >
      {children}
    </div>
  );
}