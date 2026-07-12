-- Lagrer valgt Kassalapp-produkt ({ ean, name, brand, price, store }) når en vare
-- velges fra autofullføring på handlelisten. Null for fritekst-varer.
alter table list_items add column if not exists product jsonb;
