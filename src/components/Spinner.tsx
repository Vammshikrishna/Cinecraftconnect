const Spinner = () => (
  <div className="flex items-center justify-center p-4">
    <img 
      src="/logo.png" 
      alt="Loading..." 
      className="animate-logo-motion h-12 w-12 object-contain rounded-full shadow-sm bg-white p-0.5" 
    />
  </div>
);

export default Spinner;
