var spareTimeID = 'lw-teacher-time';
var nameElAddressID = document.getElementById(spareTimeID);

var firstSparetime = []; 
var secondSparetime = []; 
var thirdSparetime = []; 

var selectedIndexSparetime = [0, 0, 0]; 

var checkedSparetime = [0, 0, 0]; 

function creatList(obj, list){
  obj.forEach(function(item, index, arr){
  var temp = new Object();
  temp.text = item.name;
  temp.value = index;
  list.push(temp);
  })
}

creatList(weekList, firstSparetime);
creatList(startTimeList, secondSparetime);
creatList(endTimeList, thirdSparetime);

var pickerSparetime = new Picker({
	data: [firstSparetime, secondSparetime, thirdSparetime],
  selectedIndex: selectedIndexSparetime,
	title: '空闲时间'
});

pickerSparetime.on('picker.select', function (selectedVal, selectedIndexSparetime) {
  var text1 = firstSparetime[selectedIndexSparetime[0]].text;
  var text2 = secondSparetime[selectedIndexSparetime[1]].text;
  var text3 = thirdSparetime[selectedIndexSparetime[2]] ? thirdSparetime[selectedIndexSparetime[2]].text : '';
	$("#" + spareTimeID).val(text1 + ' ' + text2 + ' ' + text3);
});

pickerSparetime.on('picker.change', function (index, selectedIndexSparetime) {
  if (index === 0){
    checkedSparetime[0] = selectedIndexSparetime;
  } else if (index === 1) {
    checkedSparetime[1] = selectedIndexSparetime;
  }
});

pickerSparetime.on('picker.valuechange', function (selectedVal, selectedIndexSparetime) {
  console.log(selectedVal);
  console.log(selectedIndexSparetime);
});

nameElAddressID.addEventListener('click', function () {
	pickerSparetime.show();
});



