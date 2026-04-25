// import React from "react";
// import Input from "./components/Input";

// const App = () => {
//   return (
//     <div className="min-w-screen min-h-screen flex justify-center items-center bg-linear-to-r from-[#0e111c] to-[#0c0e11] bg-[] ">
//       <div className="rounded-lg border border-gray-700 bg-[#171e2b] p-10 w-full max-w-lg ">
//         {/* header */}
//         <div className="flex items-center gap-4">
//           {/* icon */}
//           <div className="flex justify-center items-center rounded-xl uppercase bg-white font-bold text-sm size-10 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
//             {/* box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); */}
//             <img src="logo.png" alt="" />
//             {/* bg-[url('https://example.com/image.jpg')] bg-cover bg-center */}
//           </div>
//           <div>
//             <h1 className="text-3xl font-extrabold">
//               <span>Global </span>
//               <span className="text-accent">NeoChain</span>
//             </h1>
//             <p className="font-mono text-xs text-text-3">Enterprice edition</p>
//           </div>
//         </div>

//         {/* Welcome back */}
//         <div className="mt-6">
//           <h2 className="text-2xl font-semibold">Welcome back</h2>
//           <p className="text-sm text-text-2 pt-1">
//             Sign in to your GlobalNeoChain workspace
//           </p>
//         </div>

//         {/* Form  */}
//         <form action="" className="flex flex-col  mt-6">
//           {/* <div className="w-full flex flex-col my-2">
//             <label
//               htmlFor="email"
//               className="uppercase text-xs tracking-wider py-2 text-text-2 font-semibold"
//             >
//               work email
//             </label>
//             <input
//               type="email"
//               className="bg-[#101217] p-2 rounded border border-gray-800 focus:border-accent focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] outline-none"
//               placeholder=""
//             />
//           </div> */}
//           <Input name="email" label="work email" placeholder="email" />
//           <Input name="password" label="password" placeholder="*******" />
//         </form>
//       </div>
//     </div>
//   );
// };

// export default App;

import React from "react";

/*
<div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 px-2.5 py-2 sm:gap-x-4 sm:px-8 sm:py-4 lg:gap-x-6">
        <Link to="/" className="group flex min-w-0 shrink-0 items-center">
          <div className="flex items-center gap-1.5 sm:gap-4">
            <div className="relative h-10 w-14 sm:h-20 sm:w-28 flex-shrink-0">
              <img
                src={globeLogo}
                alt="SMS-IP Globe"
                className="h-full w-full object-contain transition-all duration-300"
              />
            </div>
            <div className="flex min-w-0 flex-col leading-none">
              <span className="text-base font-black tracking-wide sm:text-3xl bg-gradient-to-r from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)] bg-clip-text text-transparent">
                SMS-IP
              </span>
              <span className="hidden whitespace-nowrap text-[8px] font-semibold tracking-wider text-[hsl(190,70%,50%)] sm:block sm:text-[9px] md:text-[12.5px]">
                Sehat - Meyer - Sejahtera"
              </span>
              <span className="hidden whitespace-nowrap text-[7px] font-medium tracking-wide text-[hsl(190,60%,45%)]/70 sm:block sm:text-[8px] md:text-[15px]">
                Indonesian professionals
              </span>
            </div>
          </div>
        </Link>

        <div className="hidden min-w-0 items-center justify-around px-1 lg:flex lg:px-1.5 xl:px-4">
          <div className="flex min-w-0 items-center gap-0.5 lg:gap-1.5 xl:gap-4">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.href}
                className={`story-link whitespace-nowrap px-0.5 lg:px-1 text-xs xl:text-sm font-medium transition-all duration-300 ${
                  isActiveLink(l.href)
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <div className="hidden min-w-0 items-center justify-end gap-1 lg:gap-1.5 lg:flex xl:gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className={DESKTOP_ACTION_BUTTON_CLASS}
                >
                  {t("common.register", { ns: "translation" })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={`${DESKTOP_ACTION_MENU_CLASS} bg-card text-foreground border-border`}
              >
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground transition-colors duration-300 ring-offset-background"
                  onClick={goEmployee}
                >
                  {t("common.candidate", { ns: "translation" })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground transition-colors duration-300 ring-offset-background"
                  onClick={goEmployer}
                >
                  {t("common.company", { ns: "translation" })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/login">
              <Button
                variant="outline"
                size="lg"
                className={DESKTOP_ACTION_BUTTON_CLASS}
              >
                {t("common.login", { ns: "translation" })}
              </Button>
            </Link>

            <LanguageSelector handleLanguageChange={handleLanguageChange} />
            <ThemeToggle />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:hidden">
            <LanguageSelector
              handleLanguageChange={handleLanguageChange}
              compact
            />
            <ThemeToggle className="h-7 w-7 sm:h-9 sm:w-9" />
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted/40 sm:h-10 sm:w-10 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </button>
        </div>
      </div>
*/

const Logo = () => (
  <div className="min-h-screen min-w-screen bg-black">
    <div className="flex items-center gap-1.5 sm:gap-4">
      <div className="relative h-10 w-14 sm:h-20 sm:w-28 shrink-0">
        <img
          src="logo.png"
          alt="SMS-IP Globe"
          className="h-full w-full object-contain transition-all duration-300"
        />
      </div>
      <div className="flex min-w-0 flex-col leading-none">
        <span className="text-base font-black tracking-wide sm:text-3xl bg-linear-to-r from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)] bg-clip-text text-transparent">
          SMS-IP
        </span>
        <span className="hidden whitespace-nowrap text-[8px] font-semibold tracking-wider text-[hsl(190,70%,50%)] sm:block sm:text-[9px] md:text-[12.5px]">
          Sehat - Meyer - Sejahtera"
        </span>
        <span className="hidden whitespace-nowrap text-[7px] font-medium tracking-wide text-[hsl(190,60%,45%)]/70 sm:block sm:text-[8px] md:text-[15px]">
          Indonesian professionals
        </span>
      </div>
    </div>
  </div>
);

const App = ({ isClickable = false }) => {
  if (isClickable) {
    return (
      <Link to="/">
        <Logo />
      </Link>
    );
  }
  return <Logo />;
};

export default App;
