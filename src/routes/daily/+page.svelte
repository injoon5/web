<script lang="ts">
	import Calendar from '@event-calendar/core';
	import DayGrid from '@event-calendar/day-grid';
	import Interaction from '@event-calendar/interaction';

	let plugins = [Interaction, DayGrid];
	let options = {
		view: 'dayGridMonth',
		dateClick: (e) => {
			window.location.href = '/daily/'.concat(e.dateStr.split('T')[0]);
		}
	};
</script>

<Calendar {plugins} {options} />
