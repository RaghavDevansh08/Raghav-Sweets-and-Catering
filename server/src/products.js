export const products = [
  { id: 'motichoor-ladoo', name: 'Motichoor Ladoo', price: 420, unit: 'kg' },
  { id: 'besan-ladoo', name: 'Besan Ladoo', price: 460, unit: 'kg' },
  { id: 'kaju-katli', name: 'Kaju Katli', price: 900, unit: 'kg' },
  { id: 'gulab-jamun', name: 'Gulab Jamun', price: 320, unit: 'kg' },
  { id: 'rasgulla', name: 'Rasgulla', price: 280, unit: 'kg' },
  { id: 'milk-cake', name: 'Milk Cake', price: 480, unit: 'kg' },
  { id: 'peda', name: 'Mathura Peda', price: 500, unit: 'kg' },
  { id: 'soan-papdi', name: 'Soan Papdi', price: 300, unit: 'kg' },
  { id: 'aloo-bhujia', name: 'Aloo Bhujia', price: 240, unit: 'kg' },
  { id: 'khatta-meetha', name: 'Khatta Meetha Mix', price: 260, unit: 'kg' },
  { id: 'dal-biji', name: 'Dal Biji', price: 280, unit: 'kg' },
  { id: 'festival-box', name: 'Celebration Gift Box', price: 749, unit: 'box' }
];
export const productMap = new Map(products.map((product) => [product.id, product]));
