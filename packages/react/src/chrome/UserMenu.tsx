import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react";

/**
 * UserMenu — the app-bar user action menu, built on Radix `DropdownMenu`.
 *
 * Radix supplies the behavior (keyboard navigation — Arrow Up/Down cycle items,
 * Enter activates, Escape closes, focus returns to the trigger — plus the portalled
 * panel and focus management) while the visual surface is the shipped `@qball-inc/tokens`
 * classes: the trigger applies `.usermenu` (whose hover/open tint keys on the
 * `aria-expanded` Radix sets), and the panel + parts apply `.dropdown` / `.dropdown__head`
 * / `.dropdown__sec` / `.dropdown__row` / `.dropdown__rule` — matching the
 * `preview/app-chrome-traditional.html` oracle. Same "Radix for behavior, shipped classes
 * for style" pattern as Select. No component CSS, no hex.
 *
 * The dropdown lift is the brand's no-shadow treatment: the shipped `.dropdown` is a
 * heavier `1px solid var(--border-strong)` panel — there is NO `box-shadow` (FR4 / RB-8).
 *
 * Composition (matches the oracle):
 *   <UserMenu>
 *     <UserMenuTrigger><span className="wm"><span className="avatar">AK</span> Ashay</span></UserMenuTrigger>
 *     <UserMenuContent>
 *       <UserMenuHeader avatar={<span className="avatar avatar--lg">AK</span>} name="Ashay Kubal" email="ashay@…" />
 *       <UserMenuGroup>
 *         <UserMenuItem icon={<SettingsIcon />} onSelect={…}>Settings</UserMenuItem>
 *         <UserMenuItem icon={<KeyIcon />} onSelect={…}>API key</UserMenuItem>
 *       </UserMenuGroup>
 *       <UserMenuSeparator />
 *       <UserMenuGroup>
 *         <UserMenuItem danger icon={<SignOutIcon />} onSelect={…}>Sign out</UserMenuItem>
 *       </UserMenuGroup>
 *     </UserMenuContent>
 *   </UserMenu>
 */

/** Menu root — owns the open state. Thin alias of Radix `DropdownMenu.Root`. */
export const UserMenu = DropdownMenu.Root;

export interface UserMenuTriggerProps extends ComponentPropsWithoutRef<
  typeof DropdownMenu.Trigger
> {
  /** Use a custom element as the trigger (no extra `.usermenu` wrapper DOM). */
  asChild?: boolean;
}

/**
 * The menu trigger. By default renders a `.usermenu` button hosting the avatar/name
 * slot; pass `asChild` to make a custom element the trigger instead.
 */
export const UserMenuTrigger = forwardRef<
  ElementRef<typeof DropdownMenu.Trigger>,
  UserMenuTriggerProps
>(function UserMenuTrigger({ className, asChild, children, ...rest }, ref) {
  if (asChild === true) {
    return (
      <DropdownMenu.Trigger ref={ref} asChild {...rest}>
        {children}
      </DropdownMenu.Trigger>
    );
  }
  return (
    <DropdownMenu.Trigger
      ref={ref}
      className={["usermenu", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </DropdownMenu.Trigger>
  );
});

export interface UserMenuContentProps extends ComponentPropsWithoutRef<
  typeof DropdownMenu.Content
> {
  /** Distance from the trigger, in px. Default `6`. */
  sideOffset?: number;
}

/** The portalled `.dropdown` panel. Defaults to right-aligned under the trigger. */
export const UserMenuContent = forwardRef<
  ElementRef<typeof DropdownMenu.Content>,
  UserMenuContentProps
>(function UserMenuContent({ className, children, sideOffset = 6, align = "end", ...rest }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        className={["dropdown", className].filter(Boolean).join(" ")}
        sideOffset={sideOffset}
        align={align}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
});

export interface UserMenuHeaderProps {
  /** Avatar node (e.g. `<span className="avatar avatar--lg">AK</span>`). */
  avatar?: ReactNode;
  /** Display name. */
  name: ReactNode;
  /** Secondary line, typically the email. */
  email?: ReactNode;
}

/**
 * Non-interactive identity header (`.dropdown__head`). Radix `Label` (skipped by nav).
 * Render as a DIRECT child of `UserMenuContent` — NOT inside a `UserMenuGroup` — matching
 * the oracle's `.dropdown__head` placement at the top of the `.dropdown` panel.
 */
export function UserMenuHeader({ avatar, name, email }: UserMenuHeaderProps) {
  return (
    <DropdownMenu.Label className="dropdown__head">
      {avatar}
      <div>
        <div className="dropdown__name">{name}</div>
        {email !== undefined ? <div className="dropdown__mail">{email}</div> : null}
      </div>
    </DropdownMenu.Label>
  );
}

export type UserMenuGroupProps = ComponentPropsWithoutRef<typeof DropdownMenu.Group>;

/** A padded item group (`.dropdown__sec`). Wrap rows so they inset off the panel edge. */
export const UserMenuGroup = forwardRef<ElementRef<typeof DropdownMenu.Group>, UserMenuGroupProps>(
  function UserMenuGroup({ className, ...rest }, ref) {
    return (
      <DropdownMenu.Group
        ref={ref}
        className={["dropdown__sec", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);

export interface UserMenuItemProps extends ComponentPropsWithoutRef<typeof DropdownMenu.Item> {
  /** Tint the row as destructive (`.dropdown__row--danger`, e.g. Sign out). */
  danger?: boolean;
  /** Leading icon node (rendered before the label). */
  icon?: ReactNode;
}

/** A menu row (`.dropdown__row`). Enter / click fire `onSelect`; Radix handles focus. */
export const UserMenuItem = forwardRef<ElementRef<typeof DropdownMenu.Item>, UserMenuItemProps>(
  function UserMenuItem({ className, danger, icon, children, ...rest }, ref) {
    const cls = ["dropdown__row", danger === true ? "dropdown__row--danger" : "", className]
      .filter(Boolean)
      .join(" ");
    return (
      <DropdownMenu.Item ref={ref} className={cls} {...rest}>
        {icon}
        {children}
      </DropdownMenu.Item>
    );
  },
);

export type UserMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenu.Separator>;

/** A hairline divider between groups (`.dropdown__rule`). */
export const UserMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenu.Separator>,
  UserMenuSeparatorProps
>(function UserMenuSeparator({ className, ...rest }, ref) {
  return (
    <DropdownMenu.Separator
      ref={ref}
      className={["dropdown__rule", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});
