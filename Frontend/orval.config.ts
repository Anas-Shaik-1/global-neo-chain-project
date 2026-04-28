import { defineConfig } from "orval";

export default defineConfig({
  ems: {
    input: "http://localhost:3000/openapi.json",
    output: {
      mode: "tags-split",
      target: "src/api/generated",
      schemas: "src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: { path: "src/api/orvalAxios.ts", name: "orvalAxios" },
        query: { useQuery: true, useInfinite: false },
      },
    },
  },
});
