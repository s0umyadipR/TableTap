-- One-time 50-item Kolkata starter menu. Keep schema.sql: it creates the
-- application tables. This file only changes menu data and is safe to rerun.
CREATE TABLE IF NOT EXISTS tabletap_seed_runs (
  seed_name TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $kolkata_seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tabletap_seed_runs WHERE seed_name = 'kolkata-menu-v2') THEN
    -- Convert the original demo rows in place so existing order item snapshots stay intact.
    UPDATE menu_items AS current_item
    SET name = menu.name, description = menu.description, price = menu.price,
        category = menu.category, is_veg = menu.is_veg, image_url = menu.image_url
    FROM (VALUES
      ('Burrata & heirloom tomato', 'Kolkata alur chop', 'Crisp potato croquettes with roasted cumin, green chilli and kasundi.', 145, 'Kolkata snacks', TRUE, 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=85'),
      ('Truffle parmesan fries', 'Beguni with kasundi', 'Thin aubergine fritters in a light gram-flour batter, served with kasundi.', 155, 'Kolkata snacks', TRUE, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85'),
      ('Wild mushroom toast', 'Kolkata fish fry', 'Bhetki fillet in a crisp crumb coat with mustard kasundi and salad.', 285, 'Kolkata snacks', FALSE, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=85'),
      ('Sunday roast chicken', 'Chicken cutlet', 'Juicy spiced chicken in a golden crumb coat, with kasundi.', 265, 'Kolkata snacks', FALSE, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=85'),
      ('Creamy tomato rigatoni', 'Kosha mangsho', 'Slow-braised Bengali mutton with caramelised onion and warm spices.', 545, 'Bengali mains', FALSE, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85'),
      ('Crispy tofu grain bowl', 'Shorshe paneer', 'Paneer in a mellow mustard gravy with steamed gobindobhog rice.', 315, 'Bengali mains', TRUE, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=85'),
      ('Pistachio tiramisu', 'Mishti doi', 'Traditional slow-set sweet yoghurt, chilled in a clay-pot style cup.', 95, 'Bengali sweets', TRUE, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85'),
      ('Basque cheesecake', 'Nolen gur sandesh', 'Soft fresh-chhena sandesh scented with winter date-palm jaggery.', 115, 'Bengali sweets', TRUE, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85'),
      ('House iced latte', 'Darjeeling lemon tea', 'Fragrant Darjeeling tea with fresh lemon, served hot or iced.', 110, 'Tea & drinks', TRUE, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85'),
      ('Citrus garden spritz', 'Gondhoraj ghol', 'Cooling yoghurt drink blended with aromatic gondhoraj lime.', 125, 'Tea & drinks', TRUE, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=85')
    ) AS menu(old_name, name, description, price, category, is_veg, image_url)
    WHERE current_item.name = menu.old_name;

    WITH photos(photo_key, image_url) AS (
      VALUES
        ('snack', 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=85'),
        ('fish', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=85'),
        ('prawn', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=85'),
        ('meat', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85'),
        ('curry', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85'),
        ('veg', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=85'),
        ('rice', 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=900&q=85'),
        ('sweet', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85'),
        ('bengali-sweet', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85'),
        ('drink', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=85'),
        ('bread', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85')
    ), dishes(name, description, price, category, is_veg, photo_key) AS (
      VALUES
        ('Kolkata alur chop', 'Crisp potato croquettes with roasted cumin, green chilli and kasundi.', 145, 'Kolkata snacks', TRUE, 'snack'),
        ('Beguni with kasundi', 'Thin aubergine fritters in a light gram-flour batter, served with kasundi.', 155, 'Kolkata snacks', TRUE, 'snack'),
        ('Kolkata fish fry', 'Bhetki fillet in a crisp crumb coat with mustard kasundi and salad.', 285, 'Kolkata snacks', FALSE, 'fish'),
        ('Chicken cutlet', 'Juicy spiced chicken in a golden crumb coat, with kasundi.', 265, 'Kolkata snacks', FALSE, 'meat'),
        ('Kosha mangsho', 'Slow-braised Bengali mutton with caramelised onion and warm spices.', 545, 'Bengali mains', FALSE, 'meat'),
        ('Shorshe paneer', 'Paneer in a mellow mustard gravy with steamed gobindobhog rice.', 315, 'Bengali mains', TRUE, 'veg'),
        ('Mishti doi', 'Traditional slow-set sweet yoghurt, chilled in a clay-pot style cup.', 95, 'Bengali sweets', TRUE, 'sweet'),
        ('Nolen gur sandesh', 'Soft fresh-chhena sandesh scented with winter date-palm jaggery.', 115, 'Bengali sweets', TRUE, 'bengali-sweet'),
        ('Darjeeling lemon tea', 'Fragrant Darjeeling tea with fresh lemon, served hot or iced.', 110, 'Tea & drinks', TRUE, 'drink'),
        ('Gondhoraj ghol', 'Cooling yoghurt drink blended with aromatic gondhoraj lime.', 125, 'Tea & drinks', TRUE, 'drink'),
        ('Fish kabiraji', 'Bhetki wrapped in a lacy egg net, served with kasundi.', 285, 'Kolkata snacks', FALSE, 'fish'),
        ('Mochar chop', 'Banana-blossom croquettes with ginger, coconut and peanuts.', 185, 'Kolkata snacks', TRUE, 'snack'),
        ('Dimer devil', 'Spiced egg and potato, crumb-fried and served with kasundi.', 195, 'Kolkata snacks', FALSE, 'snack'),
        ('Ghugni chaat', 'Yellow peas with tamarind, onion, green chilli and crunchy muri.', 145, 'Kolkata snacks', TRUE, 'veg'),
        ('Phuchka tasting plate', 'Crisp puris with tangy tamarind water and spiced potato.', 175, 'Kolkata snacks', TRUE, 'snack'),
        ('Jhal muri', 'Puffed rice tossed with mustard oil, peanuts, chilli and lime.', 125, 'Kolkata snacks', TRUE, 'veg'),
        ('Koraishutir kochuri', 'Flaky fried breads filled with sweet green peas.', 175, 'Kolkata snacks', TRUE, 'bread'),
        ('Luchi and alur dom', 'Soft golden luchi with slow-cooked Bengali potato curry.', 210, 'Kolkata snacks', TRUE, 'bread'),
        ('Cholar dal with mini luchi', 'Bengal gram dal with coconut, whole spices and luchi.', 220, 'Kolkata snacks', TRUE, 'bread'),
        ('Aloor chop', 'Bengali-style spiced potato fritters with kasundi.', 135, 'Kolkata snacks', TRUE, 'snack'),
        ('Paneer cutlet', 'Crumbed paneer with herbs, served with mustard dip.', 225, 'Kolkata snacks', TRUE, 'veg'),
        ('Prawn cutlet', 'Crisp prawn cutlet with cucumber salad and kasundi.', 325, 'Kolkata snacks', FALSE, 'prawn'),
        ('Bhetki finger fry', 'Crisp bhetki strips with lemon and kasundi.', 310, 'Kolkata snacks', FALSE, 'fish'),
        ('Crispy baby corn kasundi', 'Golden baby corn with a tangy Bengali mustard dip.', 205, 'Kolkata snacks', TRUE, 'snack'),
        ('Muri ghonto croquettes', 'Crisp fish-and-rice croquettes with fresh coriander.', 245, 'Kolkata snacks', FALSE, 'fish'),
        ('Shukto', 'Bitter gourd and seasonal vegetables in a delicate Bengali milk gravy.', 235, 'Bengali mains', TRUE, 'veg'),
        ('Aloo posto', 'Potatoes folded through creamy poppy-seed paste.', 245, 'Bengali mains', TRUE, 'veg'),
        ('Dhokar dalna', 'Lentil cakes simmered in a fragrant ginger-tomato gravy.', 265, 'Bengali mains', TRUE, 'curry'),
        ('Chhanar dalna', 'Fresh cottage-cheese dumplings in a light Bengali curry.', 285, 'Bengali mains', TRUE, 'veg'),
        ('Paneer posto', 'Soft paneer in a rich poppy-seed and green-chilli sauce.', 315, 'Bengali mains', TRUE, 'veg'),
        ('Echorer dalna', 'Young jackfruit curry with potato and Bengali garam masala.', 275, 'Bengali mains', TRUE, 'curry'),
        ('Potoler dorma', 'Pointed gourds stuffed with spiced paneer in a light gravy.', 295, 'Bengali mains', TRUE, 'veg'),
        ('Chingri malai curry', 'Prawns in a gentle coconut gravy with steamed rice.', 495, 'Bengali mains', FALSE, 'prawn'),
        ('Daab chingri', 'Prawns cooked with mustard and coconut in tender green coconut.', 525, 'Bengali mains', FALSE, 'prawn'),
        ('Shorshe chingri', 'Prawns in a bright mustard and green-chilli sauce.', 465, 'Bengali mains', FALSE, 'prawn'),
        ('Shorshe ilish', 'Hilsa in mustard gravy with green chilli and steamed rice.', 625, 'Bengali mains', FALSE, 'fish'),
        ('Bhapa ilish', 'Steamed hilsa with mustard, coconut and aromatic gondhoraj.', 645, 'Bengali mains', FALSE, 'fish'),
        ('Bhetki paturi', 'Banana-leaf steamed bhetki with mustard and coconut.', 485, 'Bengali mains', FALSE, 'fish'),
        ('Bhetki jhol', 'Bengali light fish curry with potato, tomato and green chilli.', 425, 'Bengali mains', FALSE, 'fish'),
        ('Rui kalia', 'Rohu in a richly spiced onion and tomato gravy.', 385, 'Bengali mains', FALSE, 'fish'),
        ('Doi katla', 'Katla fish simmered in a creamy yoghurt and spice gravy.', 415, 'Bengali mains', FALSE, 'fish'),
        ('Pabda shorshe', 'Pabda fish in pungent mustard gravy with steamed rice.', 435, 'Bengali mains', FALSE, 'fish'),
        ('Kosha mangsho and luchi', 'Slow-braised mutton with caramelised onion and flaky luchi.', 545, 'Bengali mains', FALSE, 'meat'),
        ('Mutton dak bungalow', 'Heritage-style mutton curry with potato and boiled egg.', 565, 'Bengali mains', FALSE, 'meat'),
        ('Chicken chaap', 'Mughlai-style chicken in a silky, aromatic gravy.', 395, 'Bengali mains', FALSE, 'meat'),
        ('Chicken rezala', 'Mild chicken curry with yoghurt, cashew and fragrant spices.', 385, 'Bengali mains', FALSE, 'curry'),
        ('Kolkata chicken stew', 'Light chicken stew with potato, carrot and black pepper.', 325, 'Bengali mains', FALSE, 'curry'),
        ('Dim kosha', 'Eggs slow-cooked in a deep onion and tomato masala.', 265, 'Bengali mains', FALSE, 'curry'),
        ('Muri ghonto', 'Bengali fish-head and gobindobhog rice curry with potato.', 345, 'Bengali mains', FALSE, 'rice'),
        ('Bengali veg thali', 'Rice, dal, seasonal bhaja, shukto, chutney and sweet.', 385, 'Bengali thalis', TRUE, 'rice')
    )
    INSERT INTO menu_items(name, description, price, category, is_veg, image_url)
    SELECT dishes.name, dishes.description, dishes.price, dishes.category, dishes.is_veg, photos.image_url
    FROM dishes JOIN photos USING (photo_key)
    WHERE NOT EXISTS (SELECT 1 FROM menu_items existing WHERE lower(existing.name) = lower(dishes.name));

    UPDATE menu_items SET is_available = FALSE
    WHERE name IN (
      'Steamed gobindobhog rice', 'Basanti pulao', 'Plain luchi', 'Radhaballabhi',
      'Kolkata chicken biryani', 'Kolkata mutton biryani', 'Kolkata egg biryani', 'Kolkata aloo biryani',
      'Chicken egg roll', 'Double egg chicken roll', 'Paneer kathi roll', 'Mutton kathi roll',
      'Egg chicken chow mein', 'Veg chow mein', 'Chilli chicken', 'Chilli paneer', 'Kolkata chilli fish',
      'Chicken fried rice', 'Veg fried rice', 'Fish finger with chips', 'Chilli garlic prawns',
      'Rosogolla', 'Nolen gur rosogolla', 'Baked rosogolla', 'Kesar rajbhog', 'Kanchagolla',
      'Kheer kodom', 'Jolbhora talshash', 'Nolen gur payesh', 'Kesar rabri', 'Gondhoraj aam panna',
      'Aam pora shorbot', 'Doodh cha', 'Masala chai', 'Darjeeling first flush', 'Cold coffee',
      'Fresh lime soda', 'Mango lassi', 'Gondhoraj iced tea', 'Mineral water', 'Kolkata egg devil',
      'Fish chop', 'Chicken pakora', 'Peas kochuri with alur dom', 'Kolkata mutton roll',
      'Chicken reshmi kebab', 'Paneer tikka', 'Prawn malai toast', 'Chingri cutlet', 'Kumro phool bhaja'
    );

    INSERT INTO tabletap_seed_runs(seed_name) VALUES ('kolkata-menu-v2');
  END IF;
END
$kolkata_seed$;

CREATE INDEX IF NOT EXISTS idx_menu_items_available_category
  ON menu_items(category, name) WHERE is_available = TRUE;
