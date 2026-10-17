import { parseQuery } from "./parse-query";

(async () => {
  for (const q of ["PSL", "oat latte", "dairy-free chai", "something sweet"]) {
    console.log(q, "=>", await parseQuery(q));
  }
})();