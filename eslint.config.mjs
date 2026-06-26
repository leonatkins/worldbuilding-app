import next from "eslint-config-next";

const eslintConfig = [
  ...next,
  {
    ignores: ["node_modules/**", ".next/**", "drizzle/**"],
  },
];

export default eslintConfig;
