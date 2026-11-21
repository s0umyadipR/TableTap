-- Starter menu expansion. Names and image links are deliberately plain SQL so
-- restaurant owners can edit the menu without learning an ORM.
-- The first ten generic demo dishes are renamed only when they still have their
-- original starter names; order_items keeps its own name and price snapshots.
CREATE TABLE IF NOT EXISTS tabletap_seed_runs (
  seed_name TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $kolkata_menu$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tabletap_seed_runs WHERE seed_name = 'kolkata-menu-v1') THEN
UPDATE menu_items SET name='Kolkata alur chop', description='Crisp potato croquettes with roasted cumin, green chilli and kasundi.', price=145, category='Kolkata snacks', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=85' WHERE name='Burrata & heirloom tomato';
UPDATE menu_items SET name='Beguni with kasundi', description='Thin aubergine fritters in a light gram-flour batter, served with kasundi.', price=155, category='Kolkata snacks', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85' WHERE name='Truffle parmesan fries';
UPDATE menu_items SET name='Kolkata fish fry', description='Bhetki fillet in a crisp crumb coat with mustard kasundi and salad.', price=285, category='Kolkata snacks', is_veg=FALSE, image_url='https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=85' WHERE name='Wild mushroom toast';
UPDATE menu_items SET name='Chicken cutlet', description='Juicy spiced chicken in a golden crumb coat, with kasundi.', price=265, category='Kolkata snacks', is_veg=FALSE, image_url='https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=85' WHERE name='Sunday roast chicken';
UPDATE menu_items SET name='Kosha mangsho', description='Slow-braised Bengali mutton with caramelised onion and warm spices.', price=545, category='Bengali mains', is_veg=FALSE, image_url='https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85' WHERE name='Creamy tomato rigatoni';
UPDATE menu_items SET name='Shorshe paneer', description='Paneer in a mellow mustard gravy with steamed gobindobhog rice.', price=315, category='Bengali mains', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=85' WHERE name='Crispy tofu grain bowl';
UPDATE menu_items SET name='Mishti doi', description='Traditional slow-set sweet yoghurt, chilled in a clay-pot style cup.', price=95, category='Bengali sweets', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85' WHERE name='Pistachio tiramisu';
UPDATE menu_items SET name='Nolen gur sandesh', description='Soft fresh-chhena sandesh scented with winter date-palm jaggery.', price=115, category='Bengali sweets', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85' WHERE name='Basque cheesecake';
UPDATE menu_items SET name='Darjeeling lemon tea', description='Fragrant Darjeeling tea with fresh lemon, served hot or iced.', price=110, category='Tea & drinks', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85' WHERE name='House iced latte';
UPDATE menu_items SET name='Gondhoraj ghol', description='Cooling yoghurt drink blended with aromatic gondhoraj lime.', price=125, category='Tea & drinks', is_veg=TRUE, image_url='https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=85' WHERE name='Citrus garden spritz';

WITH photos(photo_key, image_url) AS (
  VALUES
    ('snack', 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=85'),
    ('fish', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=85'),
    ('prawn', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=85'),
    ('meat', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85'),
    ('curry', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85'),
    ('veg', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=85'),
    ('rice', 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=900&q=85'),
    ('roll', 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=85'),
    ('noodles', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85'),
    ('sweet', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85'),
    ('bengali-sweet', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85'),
    ('drink', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=85'),
    ('tea', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85'),
    ('bread', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85')
), dishes(name, description, price, category, is_veg, photo_key) AS (
  VALUES
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
    ('Paneer cutlet', 'Crumbed paneer with herbs, served with mustard dip.', 225, 'Kolkata snacks', TRUE, 'snack'),
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
    ('Dim kosha', 'Eggs slow-cooked in a deep onion and tomato masala.', 265, 'Bengali mains', TRUE, 'curry'),
    ('Muri ghonto', 'Bengali fish-head and gobindobhog rice curry with potato.', 345, 'Bengali mains', FALSE, 'rice'),
    ('Bengali veg thali', 'Rice, dal, seasonal bhaja, shukto, chutney and sweet.', 385, 'Bengali thalis', TRUE, 'rice'),
    ('Bengali fish thali', 'Rice, dal, vegetables, fish curry, chutney and sweet.', 495, 'Bengali thalis', FALSE, 'fish'),
    ('Kosha mangsho thali', 'Gobindobhog rice, dal, seasonal sides and kosha mangsho.', 625, 'Bengali thalis', FALSE, 'meat'),
    ('Luchi alur dom thali', 'Luchi, alur dom, cholar dal, salad and mishti doi.', 355, 'Bengali thalis', TRUE, 'bread'),
    ('Steamed gobindobhog rice', 'Fragrant short-grain Bengali rice, steamed to order.', 125, 'Rice & breads', TRUE, 'rice'),
    ('Basanti pulao', 'Golden gobindobhog rice with ghee, cashews and raisins.', 225, 'Rice & breads', TRUE, 'rice'),
    ('Plain luchi', 'Four soft, puffed Bengali fried breads.', 95, 'Rice & breads', TRUE, 'bread'),
    ('Radhaballabhi', 'Flaky lentil-stuffed bread with potato curry.', 195, 'Rice & breads', TRUE, 'bread'),
    ('Kolkata chicken biryani', 'Fragrant dum biryani with chicken, potato and egg.', 385, 'Biryani & rolls', FALSE, 'rice'),
    ('Kolkata mutton biryani', 'Slow-cooked mutton, aromatic rice, potato and egg.', 465, 'Biryani & rolls', FALSE, 'rice'),
    ('Kolkata egg biryani', 'Gobindobhog-style aromatic rice with egg and potato.', 285, 'Biryani & rolls', FALSE, 'rice'),
    ('Kolkata aloo biryani', 'Fragrant dum rice with the signature tender potato.', 245, 'Biryani & rolls', TRUE, 'rice'),
    ('Chicken egg roll', 'Kolkata paratha roll with chicken, egg, onion and lime.', 225, 'Biryani & rolls', FALSE, 'roll'),
    ('Double egg chicken roll', 'Two-egg paratha roll with spiced chicken and onion.', 265, 'Biryani & rolls', FALSE, 'roll'),
    ('Paneer kathi roll', 'Paratha wrapped around paneer tikka and crunchy salad.', 215, 'Biryani & rolls', TRUE, 'roll'),
    ('Mutton kathi roll', 'Kolkata-style paratha roll with tender mutton kebab.', 295, 'Biryani & rolls', FALSE, 'roll'),
    ('Egg chicken chow mein', 'Kolkata street-style noodles with egg and chicken.', 255, 'Kolkata Chinese', FALSE, 'noodles'),
    ('Veg chow mein', 'Wok-tossed noodles with cabbage, carrot and spring onion.', 195, 'Kolkata Chinese', TRUE, 'noodles'),
    ('Chilli chicken', 'Crisp chicken tossed with chilli, onion and peppers.', 315, 'Kolkata Chinese', FALSE, 'meat'),
    ('Chilli paneer', 'Paneer tossed in a tangy Indo-Chinese chilli sauce.', 285, 'Kolkata Chinese', TRUE, 'veg'),
    ('Kolkata chilli fish', 'Crisp fish bites wok-tossed with chilli and spring onion.', 345, 'Kolkata Chinese', FALSE, 'fish'),
    ('Chicken fried rice', 'Wok-fried rice with chicken, egg and spring onion.', 245, 'Kolkata Chinese', FALSE, 'rice'),
    ('Veg fried rice', 'Wok-fried rice with seasonal vegetables and spring onion.', 195, 'Kolkata Chinese', TRUE, 'rice'),
    ('Fish finger with chips', 'Crisp fish fingers with potato chips and kasundi mayo.', 325, 'Kolkata Chinese', FALSE, 'fish'),
    ('Chilli garlic prawns', 'Prawns tossed in a sharp chilli-garlic sauce.', 425, 'Kolkata Chinese', FALSE, 'prawn'),
    ('Rosogolla', 'Soft chhena dumplings in a light sugar syrup.', 95, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Nolen gur rosogolla', 'Fresh chhena dumplings in winter date-palm jaggery syrup.', 125, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Baked rosogolla', 'Warm baked chhena sweet with a caramelised top.', 145, 'Bengali sweets', TRUE, 'sweet'),
    ('Kesar rajbhog', 'Large saffron chhena sweet filled with nuts.', 135, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Kanchagolla', 'Delicate melt-in-the-mouth fresh chhena sweet.', 115, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Kheer kodom', 'Layered chhena sweet with a creamy kheer centre.', 135, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Jolbhora talshash', 'Seasonal chhena sweet with a fragrant liquid centre.', 145, 'Bengali sweets', TRUE, 'bengali-sweet'),
    ('Nolen gur payesh', 'Creamy gobindobhog rice pudding with date-palm jaggery.', 155, 'Bengali sweets', TRUE, 'sweet'),
    ('Kesar rabri', 'Slow-reduced milk pudding with saffron and pistachio.', 165, 'Bengali sweets', TRUE, 'sweet'),
    ('Gondhoraj aam panna', 'Tart green mango cooler lifted with fragrant gondhoraj lime.', 125, 'Tea & drinks', TRUE, 'drink'),
    ('Aam pora shorbot', 'Smoky green mango cooler with roasted cumin.', 115, 'Tea & drinks', TRUE, 'drink'),
    ('Doodh cha', 'Strong Kolkata milk tea simmered with ginger and cardamom.', 75, 'Tea & drinks', TRUE, 'tea'),
    ('Masala chai', 'Freshly brewed black tea with warming whole spices.', 85, 'Tea & drinks', TRUE, 'tea'),
    ('Darjeeling first flush', 'Light, floral Darjeeling tea served freshly brewed.', 110, 'Tea & drinks', TRUE, 'tea'),
    ('Cold coffee', 'Chilled espresso blended with milk and a touch of sugar.', 145, 'Tea & drinks', TRUE, 'drink'),
    ('Fresh lime soda', 'Fresh lime, soda and a choice of sweet or salted.', 105, 'Tea & drinks', TRUE, 'drink'),
    ('Mango lassi', 'Thick yoghurt and ripe mango blended until creamy.', 155, 'Tea & drinks', TRUE, 'drink'),
    ('Gondhoraj iced tea', 'Cold-brew tea with fragrant gondhoraj lime.', 125, 'Tea & drinks', TRUE, 'drink'),
    ('Mineral water', 'Chilled bottled drinking water.', 40, 'Tea & drinks', TRUE, 'drink'),
    ('Kolkata egg devil', 'Egg and potato cutlet with crunchy crumbs and kasundi.', 185, 'Kolkata snacks', FALSE, 'snack'),
    ('Fish chop', 'Bengali fish croquette with potato, herbs and green chilli.', 235, 'Kolkata snacks', FALSE, 'fish'),
    ('Chicken pakora', 'Crisp chicken fritters with onion and Bengali spices.', 215, 'Kolkata snacks', FALSE, 'snack'),
    ('Peas kochuri with alur dom', 'Green-pea stuffed kochuri with slow-cooked potatoes.', 225, 'Kolkata snacks', TRUE, 'bread'),
    ('Kolkata mutton roll', 'Flaky paratha wrapped around peppery mutton kebab.', 315, 'Biryani & rolls', FALSE, 'roll'),
    ('Chicken reshmi kebab', 'Soft yoghurt-marinated chicken kebab with mint chutney.', 345, 'Bengali mains', FALSE, 'meat')
)
INSERT INTO menu_items(name, description, price, category, is_veg, image_url)
SELECT d.name, d.description, d.price, d.category, d.is_veg, p.image_url
FROM dishes d
JOIN photos p USING (photo_key)
WHERE NOT EXISTS (SELECT 1 FROM menu_items existing WHERE lower(existing.name)=lower(d.name));

    INSERT INTO tabletap_seed_runs(seed_name) VALUES ('kolkata-menu-v1');
  END IF;
END
$kolkata_menu$;
