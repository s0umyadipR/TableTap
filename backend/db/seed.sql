INSERT INTO
  menu_items (
    name,
    description,
    price,
    category,
    is_veg,
    image_url
  )
SELECT
  *
FROM
  (
    VALUES
      (
        'Burrata & heirloom tomato',
        'Creamy burrata, ripe tomato, basil oil, toasted sourdough.',
        385,
        'Small plates',
        TRUE,
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Truffle parmesan fries',
        'Crisp shoestring fries, shaved parmesan, truffle aioli.',
        245,
        'Small plates',
        TRUE,
        'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Wild mushroom toast',
        'Sourdough, whipped ricotta, thyme, wild mushrooms.',
        325,
        'Small plates',
        TRUE,
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Sunday roast chicken',
        'Herb roasted chicken, lemon jus, buttered greens.',
        565,
        'From the kitchen',
        FALSE,
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Creamy tomato rigatoni',
        'Slow-cooked tomato, cream, basil, aged parmesan.',
        425,
        'From the kitchen',
        TRUE,
        'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Crispy tofu grain bowl',
        'Ginger sesame tofu, brown rice, crunchy greens.',
        395,
        'From the kitchen',
        TRUE,
        'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Pistachio tiramisu',
        'Espresso-soaked layers, mascarpone, toasted pistachio.',
        275,
        'Something sweet',
        TRUE,
        'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Basque cheesecake',
        'Caramelised top, soft centre, seasonal berry compote.',
        295,
        'Something sweet',
        TRUE,
        'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'House iced latte',
        'Double espresso, oat or dairy milk, a little sweetness.',
        195,
        'Coffee & drinks',
        TRUE,
        'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=720&q=82'
      ),
      (
        'Citrus garden spritz',
        'Orange, rosemary, sparkling water, served over ice.',
        185,
        'Coffee & drinks',
        TRUE,
        'https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=720&q=82'
      )
  ) AS starter (
    name,
    description,
    price,
    category,
    is_veg,
    image_url
  )
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      menu_items
  );