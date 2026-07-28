import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  { ignores: [".next/**", "coverage/**", "docs/reference/**", "next-env.d.ts", "supabase/.temp/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
