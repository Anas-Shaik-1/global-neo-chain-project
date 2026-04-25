import React from "react";

const Input = ({ label = "", name = "", placeholder = "" }, ...props) => {
  return (
    <div className="w-full flex flex-col my-2">
      <label
        htmlFor="email"
        className="uppercase text-xs tracking-wider py-2 text-text-2 font-semibold"
      >
        {label}
      </label>
      <input
        {...props}
        placeholder={placeholder}
        className="bg-[#101217] p-2 rounded border border-gray-800 focus:border-accent focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] outline-none"
        name={name}
      />
    </div>
  );
};

export default Input;
