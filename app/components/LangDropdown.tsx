import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { LanguageIcon } from "./ViewIcons";

type TargetLanguage = "en" | "ru";

type LangDropdownProps = {
  currentLang: TargetLanguage;
  onLanguageChange: (lang: TargetLanguage) => void;
  disabled?: boolean;
};

const items = [
  { key: "en", label: "English" },
  { key: "ru", label: "Russian" },
];

export default function LangDropdown({
  currentLang,
  onLanguageChange,
  disabled = false,
}: LangDropdownProps) {
  return (
    <Dropdown isDisabled={disabled}>
      <DropdownTrigger>
        <Button
          variant="solid"
          color="primary"
          disabled={disabled}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <LanguageIcon />
          <span className="tracking-widest uppercase text-[10px] sm:text-xs text-white/40">
            {currentLang === "en" ? "English" : "Russian"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Language selection"
        items={items}
        className="min-w-[180px] rounded-xl border border-white/10 bg-[#0f1419] shadow-xl"
        onAction={(key) => onLanguageChange(key as TargetLanguage)}
      >
        {(item) => (
          <DropdownItem
            key={item.key}
            className={`w-full not-last:mb-1 rounded-lg px-3 py-2 text-left text-sm uppercase tracking-widest text-white/60 transition-colors duration-150 ${
              item.key === currentLang
                ? "bg-emerald-400/20 text-white ring-1 ring-emerald-400/30"
                : "hover:bg-white/10 hover:text-white active:bg-white/15"
            }`}
          >
            {item.label}
          </DropdownItem>
        )}
        {/* border border-emerald-400/30 */}
      </DropdownMenu>
    </Dropdown>
  );
}
