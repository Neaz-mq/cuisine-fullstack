-- এক order-এ একবারই ORDER_DEDUCTION, আর একবারই RETURN.
--
-- advanceOrderToPreparing এখন transaction-এর ভেতরে check করে, কিন্তু
-- Postgres-এর default READ COMMITTED isolation-এ দুটো concurrent
-- transaction তখনও একে অপরের এখনো-commit-না-হওয়া row দেখতে পায় না।
-- তাই application-level check একা যথেষ্ট নয় — এই index-টাই আসল guard,
-- দ্বিতীয় transaction P2002 নিয়ে fail করবে।
CREATE UNIQUE INDEX "one_deduction_per_order"
  ON "StockMovement" ("orderId")
  WHERE type = 'ORDER_DEDUCTION' AND "orderId" IS NOT NULL;

CREATE UNIQUE INDEX "one_return_per_order"
  ON "StockMovement" ("orderId")
  WHERE type = 'RETURN' AND "orderId" IS NOT NULL;