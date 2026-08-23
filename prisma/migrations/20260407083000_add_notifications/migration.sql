CREATE TYPE "NotificationType" AS ENUM ('ORDER_CREATED', 'DELIVERY_CONFIRMED');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "order_id" TEXT,
    "kode_order" TEXT NOT NULL,
    "target_role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_target_role_created_at_idx" ON "Notification"("target_role", "created_at");
CREATE INDEX "Notification_order_id_idx" ON "Notification"("order_id");
CREATE INDEX "NotificationRecipient_user_id_created_at_idx" ON "NotificationRecipient"("user_id", "created_at");
CREATE INDEX "NotificationRecipient_notification_id_idx" ON "NotificationRecipient"("notification_id");
CREATE UNIQUE INDEX "NotificationRecipient_notification_id_user_id_key" ON "NotificationRecipient"("notification_id", "user_id");

ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_notification_id_fkey"
FOREIGN KEY ("notification_id") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
