-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "calories" INTEGER,
ADD COLUMN     "carbGrams" DOUBLE PRECISION,
ADD COLUMN     "fatGrams" DOUBLE PRECISION,
ADD COLUMN     "foodStatus" TEXT,
ADD COLUMN     "ingredientTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prepTimeMinutes" INTEGER,
ADD COLUMN     "proteinGrams" DOUBLE PRECISION;
