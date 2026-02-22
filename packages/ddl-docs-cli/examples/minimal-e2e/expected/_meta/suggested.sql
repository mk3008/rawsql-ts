-- suggested: v1 (not applied)
ALTER TABLE "public"."order_item" ADD FOREIGN KEY ("product_id") REFERENCES "master"."product"("product_id");
ALTER TABLE "public"."order" ADD FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id");
