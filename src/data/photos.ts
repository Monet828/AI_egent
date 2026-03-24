// Unsplash の無料画像URL（住宅・建築・インテリア）
// ?w=800&h=600&fit=crop でサイズ統一

// ===== 外観テイスト写真（Q13） =====
export const EXTERIOR_PHOTOS: Record<string, string> = {
  simple_modern:
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
  natural_nordic:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
  japanese_modern:
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop",
  industrial:
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
  resort:
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
  hiraya:
    "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop",
};

// ===== 内装テイスト写真（Q14） =====
export const INTERIOR_PHOTOS: Record<string, string> = {
  white_clean:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop",
  natural_wood:
    "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=600&fit=crop",
  monotone:
    "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?w=800&h=600&fit=crop",
  cafe_vintage:
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
  japanese:
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop",
  colorful:
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
};

// ===== 工務店施工事例写真 =====
export const BUILDER_PHOTOS: Record<
  string,
  { exterior: string; interior1: string; interior2: string }
> = {
  builder_001: {
    // エコパフォーマンスホーム（性能特化・シンプルモダン）
    exterior:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
    interior1:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop",
    interior2:
      "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=600&fit=crop",
  },
  builder_002: {
    // アーキデザイン工房（デザイン×性能ハイエンド）
    exterior:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
    interior1:
      "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?w=800&h=600&fit=crop",
    interior2:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
  },
  builder_003: {
    // スマートバリューホーム（コスパ特化・ナチュラル北欧）
    exterior:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    interior1:
      "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=600&fit=crop",
    interior2:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop",
  },
  builder_004: {
    // くらし設計室（暮らし提案・ナチュラル）
    exterior:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    interior1:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
    interior2:
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop",
  },
  builder_005: {
    // 信頼の家づくり工房（老舗・和モダン）
    exterior:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop",
    interior1:
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop",
    interior2:
      "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=600&fit=crop",
  },
};
