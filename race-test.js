import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

export const options = {
  scenarios: {
    guest_checkout_throughput: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || "60s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1200"],
    add_to_cart_success_rate: ["rate>0.95"],
    checkout_success_rate: ["rate>0.80"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000/api";
const LAPTOP_ID = __ENV.LAPTOP_ID || "97d997f6-2b21-40a1-a3ca-a1d2d0e00604";

const addToCartSuccessRate = new Rate("add_to_cart_success_rate");
const checkoutSuccessRate = new Rate("checkout_success_rate");

export default function () {
  const addRes = http.post(
    `${BASE_URL}/cart/guest/items`,
    JSON.stringify({
      laptopId: LAPTOP_ID,
      quantity: 1,
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  const addOk = check(addRes, {
    "add item accepted": (r) => r.status === 201,
  });
  addToCartSuccessRate.add(addOk);

  if (!addOk) {
    return;
  }

  const orderRes = http.post(
    `${BASE_URL}/orders/guest`,
    JSON.stringify({
      fullName: `Guest User ${__VU}`,
      phone: "01011223344",
      city: "Cairo",
      area: "Nasr City",
      streetAddress: "Testing Street 123",
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  const orderOk = check(orderRes, {
    "checkout completed": (r) => r.status === 201,
  });
  checkoutSuccessRate.add(orderOk);
}
