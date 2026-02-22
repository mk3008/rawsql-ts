-- suggested: v1 (not applied)
ALTER TABLE "public"."order_item" ADD FOREIGN KEY ("product_id") REFERENCES "master"."product"("product_id");
ALTER TABLE "public"."order" ADD FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id");
COMMENT ON COLUMN "public"."order_item_snapshot"."order_id" IS 'order identifier';
COMMENT ON COLUMN "public"."order_item"."product_code" IS 'business product code';
COMMENT ON COLUMN "public"."order"."order_id" IS 'order identifier';
