const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config()

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(process.cwd() + '/public'));


// Подключаемся к базе данных
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 40000, // Увеличение тайм-аута до 40 секунд
})
  .then(() => console.log('Successfully connected to MongoDB Atlas'))
  .catch(err => console.error('Connection error', err));


//создаем схему для упражнений
var exerciseSchema = new mongoose.Schema({
	description: { type: String, required: true },
	duration: { type: Number, required: true },
	date: { type: Date, default: Date.now }
});


// создаем схему и задаем тип
var userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  exercises: { type:[exerciseSchema], default: [] }
});

var User = mongoose.model("User", userSchema);


app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});



//создаем пользователя
app.post('/api/users', async (req, res) => {
  var { username } = req.body;
  var newUser = new User({ username });
  await newUser.save();
  res.json({ username: newUser.username, _id: newUser._id });
});

//получаем список пользователей
app.get('/api/users', async (req, res) => {
	var users = await User.find();
	res.json(users);
});


//добавление упражнения к пользователю
app.post('/api/users/:_id/exercises', async (req, res) => {
	var { description, duration, date } = req.body;
	var userId = req.params._id;
	
	try {
		var user = await User.findById(userId);
		if (!user) return res.json('Пользователь не найден.');
		
		if(!description || !duration) return res.json({ error: 'Description и Duration обязательный.' });
		 
			
		var newExercise = {
			description,
			duration: parseInt(duration),
			date: date ? new Date(date) : new Date()
		};
		
		//console.log('Перед добавлением упражнения:', user.exercises);
		user.exercises.push(newExercise);
		await user.save();
		//console.log('После добавления:', user.exercises);
		
		res.json({
			username: user.username,
			description: newExercise.description,
			duration: newExercise.duration,
			date: newExercise.date.toDateString(),
			_id: user._id,
		});
	} catch (error) {
		res.json(error.message);
	}
});


// получение логов
app.get('/api/users/:_id/logs', async (req, res) => {
	var userId = req.params._id;
	var { from, to, limit } = req.query;
	
	try {
		var user = await User.findById(userId);
		if (!user) return res.json('Пользователь не найден.');
		
		//преобразование параметра from & to в даты
		var fromDate = from ? new Date(from) : new Date(0); // если не указан, то начинам с 1970
		var toDate = to ? new Date(to) : new Date(); // если не указан, заканчиваем на текущей дате
		
		//фильтрация по дате
		var filteredExercises = user.exercises.filter(exercise => {
			var exerciseDate = new Date(exercise.date);
			return exerciseDate >= fromDate && exerciseDate <= toDate;
		});
		
		//задаем ограничение на возвращаемые записи
		var limitedExercises = limit ? filteredExercises.slice(0, parseInt(limit)) : filteredExercises;
		
		var log = limitedExercises.map(exercise => ({
			description: exercise.description,
			duration: exercise.duration,
			date: exercise.date.toDateString()
		}));
		
		res.json({
			username: user.username,
			count: log.length,
			_id: user._id,
			log
		});
	} catch (error) {
		res.json(error.message);
	}
});


// загрузка файлов
app.post('/api/fileanalyse', upload.single('upfile'), (req, res) => {
  if (req.file) {
    var { originalname, mimetype, size } = req.file;
    return res.json ({
      name: originalname,
      type: mimetype,
      size: size,
    });
  }
  res.json({ error: 'Файл не загружен.' });
});



const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Your app is listening on port ' + port)
});
