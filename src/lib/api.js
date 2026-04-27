import { supabase } from "./supabase";

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*");
  if (error) throw error;
  return data;
}
export async function addProduct(product) {
  const { data, error } = await supabase.from("products").insert([product]).select().single();
  if (error) throw error;
  return data;
}
export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
export async function getOrders() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function placeOrder(order) {
  const { data, error } = await supabase.from("orders").insert([order]).select().single();
  if (error) throw error;
  return data;
}
export async function updateOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}
export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error) return null;
  return data;
}
export async function updateSettings(settings) {
  const { data, error } = await supabase.from("settings").upsert([{ id: 1, ...settings }]).select().single();
  if (error) throw error;
  return data;
}
export async function getCoupons() {
  const { data, error } = await supabase.from("coupons").select("*");
  if (error) throw error;
  return data;
}
export async function addCoupon(coupon) {
  const { data, error } = await supabase.from("coupons").insert([coupon]).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCoupon(id) {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw error;
}
export async function getFaqs() {
  const { data, error } = await supabase.from("faq_items").select("*");
  if (error) throw error;
  return data;
}
export async function addFaq(faq) {
  const { data, error } = await supabase.from("faq_items").insert([faq]).select().single();
  if (error) throw error;
  return data;
}
export async function deleteFaq(id) {
  const { error } = await supabase.from("faq_items").delete().eq("id", id);
  if (error) throw error;
}