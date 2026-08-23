ALTER TABLE "Order_Header"
ADD COLUMN "ratio_cb_1tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ratio_cb_2tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shell_state_cb_1tr" TEXT,
ADD COLUMN "shell_state_cb_2tr" TEXT;
