-- Notification তালিকার "সব পড়া হয়েছে" চিহ্ন।
--
-- ⚠️ কোনো Notification টেবিল নেই, ইচ্ছাকৃতভাবে — তালিকাটা অর্ডার, বুকিং,
--    রিভিউ আর কম-স্টকের সারি থেকে তৈরি হয়। তাই একটাই timestamp যথেষ্ট:
--    এর পরে ঘটা সব কিছুই অপঠিত। বিস্তারিত schema.prisma-র মন্তব্যে।

ALTER TABLE "StaffProfile" ADD COLUMN "notificationsReadAt" TIMESTAMP(3);
