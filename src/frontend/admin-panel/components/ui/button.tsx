// Re-export del design system compartido. Los call-sites siguen importando
// "@/components/ui/button" sin cambios; la implementación vive en @smartmenu/ui.
export { Button, buttonVariants, type ButtonProps } from "@smartmenu/ui";
