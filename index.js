const express = require('express'),
    mongoose = require('mongoose')
    https://github.com/ncioo/test-app.git
    app = express()
    app.use(express.json())

//  Дефайним схему для товара и категории
let itemSchema = new mongoose.Schema(
        {
            id: Number,
            name: String,
            price: Number,
            added: { type: Date, default: Date.now },
            version: { type: Number, default: 1 },
            cat: Array
        }
    ),
    categorySchema = new mongoose.Schema(
        {
            id: Number,
            name: String,
            items: Array
        }
    )

//  Подключаем их
const Item = mongoose.model('Item', itemSchema)
const Category = mongoose.model('Category', categorySchema)

//  Подключаемся к базе
mongoose.connect('mongodb://localhost:27017/data').then(async db => {

    /*
    *   Ответ на корневой GET запрос
    */
    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/views/index.html')
    })

    /*
    *   Ответ на GET запрос всех категорий БЕЗ возврата данных самих товаров (только их ID)
    */
    app.get('/category', (req, res) => {
        Category.find((err, data) => {  // Получаем категории
            let arr = []    // Дефайним пустой массив
                data.forEach(e => arr.push({ id: e.id, name: e.name, items: e.items })) // Добавляем в 'arr' интересующие нас данные
                res.json(arr)  // Отправляем в JSONе
        })
    })

    /*
    *   Ответ на GET запрос категории по айди БЕЗ возврата всех товаров,
    *   НО с возвратом максимальной, минимальной и средней цен
    */
    app.get('/category/:id', async (req, res) => {
        let cat = await Category.findOne({ id: req.params.id }),   // Получаем категорию по ID
            items = await Item.find(),   // Получаем все товары
            price = getPrice(items.filter(e => e.cat.includes(cat.name)))   // Вызываем функцию получения цены

            // Моделируем объект для отправки
            let data = {
                name: cat.name,
                size: cat.items.length,
                price: price
            }
            res.json(data)  // Отправляем в JSONе

            // Функция получения цены
            function getPrice(arr) {
                let mid = 0,    // Дефайним числовую переменную
                    a = [];    // Дефайним пустой массив
                    arr.sort((a, b) => { return parseInt(a.price) - parseInt(b.price) })    // Сортируем массив товаров по возрастанию цены
                    arr.forEach(e => {   // Запускаем перебор товаров
                        let i = a.find(el => el.name == e.name)   // Проверяем есть ли в массиве 'a' товар с таким же названием
                        if (!i) {   // Если нету похожих
                            a.push(e)   // Запихиваем товар в массив 'a'
                        } else {    // Если есть похожие
                            if (i.version < e.version) {    // Проверяем является версия товара в массиве 'a' больше чем версия элемента и если да, то
                                a.splice(a.indexOf(i), 1)   //  Удаляем товар из массива 'a'
                                a.push(e)   // Запихиваем новый товар
                            }
                        }
                    })
                    a.forEach(el => { return mid = parseInt(el.price) + mid })  // Перебираем товары массива 'a' и записываем их цены в 'mid'
                    return { min: arr[0].price, max: arr[arr.length - 1].price, mid: parseInt(mid / a.length) } // Возвращаем полученную стоимость
            }
    })

    /*
    *   Ответ на GET запрос товара по айди
    */
    app.get('/items/:id', (req, res) => {
        Item.findOne({ id: req.params.id }, (err, data) => {    // Получаем товар по ID, взятого из URLа
            res.json(data)  // Отправляем в JSONе
        })
    })

    /*
    *   Ответ на POST запрос товара по названию
    */
    app.post('/items', (req, res) => {
            Item.find({ name: req.body.name }, (err, data) => {   // Получаем товары по названию, взятого из body запроса
                data.sort((a, b) => { return a.version - b.version })   // Сортируем по убыванию версии
                return res.json(data[0])    // Отправляем в JSONе самый первый товар (у него будет самая последняя версия)
            })
    })

    //  Слушаем порт 3000
    app.listen(3000)

    /*
    *   Функция добавления товара
    *   Пример: 
    *   await addItem({ name: 'Samsung', price: '500', cat: ['Note 10', 'Mobile', 'Metal'] })
    */
    async function addItem(obj) {
        let version = await getHighestVersion(Item, obj.name),  // Получаем число (последняя версия похожего товара + 1)
            id = await getHighestId(Item),  // Получаем число (самый большой ID + 1)
            // Моделируем объект для добавления
            item = {
                id: id,
                name: obj.name,
                price: obj.price,
                added: Date.now(),
                version: version,
                cat: obj.cat
            }
            Item.create(item)   // Добавляем в базу
            console.log(`•  Товар "${item.name}" добавлен! -- ID: ${item.id} | Version: ${item.version} --`)    // Выводим в консоль результат выполнения
    }

    /*
    *   Функция удаления товара по ID
    *   Пример: 
    *   await removeItem(5)
    */
    async function removeItem(id) {
        let i = await Item.findOne({ id: id })  // Получаем товар по ID
            if (i) {    // Если такой есть
                await Item.deleteOne({ id: id })    // Удаляем
                console.log(`•  Товар "${i.name}" удален! -- ID: ${i.id} | Version: ${i.version} --`)   // Выводим в консоль результат выполнения
            } else return console.log(`•  Товар с таким ID не найден`)  // Если нету, выводим ошибку
    }

    /*
    *   Функция добавления категории
    *   Пример: 
    *   await addCategory({ name: 'Tablet' })
    */
    async function addCategory(obj) {
        let id = await getHighestId(Category), // Получаем число (самый большой ID + 1)
            items = await Item.find(),  // Получаем все товары
            // Моделируем объект для добавления
            cat = {
                id: id,
                name: obj.name,
                items: items.filter(e => e.cat.includes(obj.name)).map(e => e.id) // В 'items' запихиваем ID всех товаров, у которых в категориях указано название добавляемой категории
            }
            Category.create(cat)   // Добавляем в базу
            console.log(`•  Категория "${cat.name}" добавлена! -- ID: ${cat.id} --`)   // Выводим в консоль результат выполнения
    }

    /*
    *   Функция удаления категории по ID
    *   Пример: 
    *   await removeCategory(5)
    */
    async function removeCategory(id) {
        let i = await Category.find({ id: id }) // Получаем категорию по ID
        if (i) {    // Если такая есть
            await Category.deleteOne({ id: id })    // Удаляем
            console.log(`•  Категория "${i[0].name}" удалена! -- ID: ${i[0].id} --`)   // Выводим в консоль результат выполнения
        } else return console.log(`•  Категория с таким ID не найдена`)  // Если нету, выводим ошибку
    }

    /*
    *   Функция получения самого большого ID в коллекции + 1
    *   Пример: 
    *   let id = await getHighestId(Item)
    */
    async function getHighestId(collection) {
        let i = 1,  // Дефайним числовую переменную 
            data = await collection.find()  // Получаем все записи из коллекции
            data.forEach(e => {     // Перебираем все и присваиваем 'i' большее число по принципу: если i меньше или равно ID, то i = ID + 1
                if (e.id >= i) return i = e.id + 1 
            })
            return i    // Возвращаем число
    }

    /*
    *   Функция получения самой последней версии в коллекции + 1
    *   Пример: 
    *   let id = await getHighestVersion(Item, 'iPhone)
    */
    async function getHighestVersion(collection, name) {
        let i = 1,  // Дефайним числовую переменную 
            data = await collection.find({ name: name}) // Получаем все записи с одинаковыми названиями из коллекции
            data.forEach(e => {
                if (e.version >= i) return i = e.version + 1 // Перебираем все и присваиваем 'i' большее число по принципу: если i меньше или равно версии, то i = версия + 1
            })
            return i    // Возвращаем число
    }
})
